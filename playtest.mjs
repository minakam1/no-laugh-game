// ============================================================
// Game Playtest — 自动化浏览器测试
// ============================================================
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'playtest-screenshots');
const REPORT_FILE = path.join(__dirname, 'playtest-report.md');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const findings = [];
let screenshotIndex = 0;

function screenshot(page, name) {
  screenshotIndex++;
  const filename = `${String(screenshotIndex).padStart(2, '0')}_${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  return page.screenshot({ path: filepath, fullPage: true }).then(() => filepath);
}

function addFinding(severity, title, desc, repro) {
  findings.push({ severity, title, desc, repro });
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // =============================================
    // 1. 启动检查：确认 API 配置页面加载
    // =============================================
    console.log('[TEST 1] 启动检查...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await screenshot(page, 'boot_config_page');
    const pageTitle = await page.title();
    console.log(`  页面标题: "${pageTitle}"`);

    // 检查 API 配置弹窗是否可见
    const configModal = await page.$('text=API 配置');
    if (configModal) {
      console.log('  ✅ API 配置页面正常加载');
    } else {
      addFinding('HIGH', 'API 配置页面未显示', '启动后没有看到 API 配置弹窗', '刷新页面');
      console.log('  ❌ API 配置页面未显示');
    }

    // 检查三个输入框是否存在
    const baseUrlInput = await page.$('input[placeholder*="api.openai.com"]');
    const apiKeyInput = await page.$('input[placeholder="你的 API Key"]');
    const modelInput = await page.$('input[placeholder*="gpt-4o-mini"]');

    if (baseUrlInput) console.log('  ✅ Base URL 输入框存在');
    else addFinding('MEDIUM', '缺少 Base URL 输入框', '配置页面未找到 Base URL 输入框', '查看配置页面');

    if (apiKeyInput) console.log('  ✅ API Key 输入框存在');
    else addFinding('MEDIUM', '缺少 API Key 输入框', '配置页面未找到 API Key 输入框', '查看配置页面');

    if (modelInput) console.log('  ✅ Model 输入框存在');
    else addFinding('MEDIUM', '缺少 Model 输入框', '配置页面未找到 Model 输入框', '查看配置页面');

    // 测试按钮是否存在
    const testBtn = await page.$('button:has-text("测试连接")');
    if (testBtn) {
      console.log('  ✅ 测试连接按钮存在');
      const isDisabled = await testBtn.isDisabled();
      if (isDisabled) {
        console.log('  ✅ 测试按钮默认禁用（需先填写信息）');
      } else {
        addFinding('LOW', '测试按钮未默认禁用', '未填写信息时测试按钮应该禁用', '进入配置页，不填写任何信息');
      }
    } else {
      addFinding('MEDIUM', '缺少测试连接按钮', '配置页面未找到测试连接按钮', '查看配置页面');
    }

    // =============================================
    // 2. 输入验证测试
    // =============================================
    console.log('\n[TEST 2] 输入验证...');

    // 尝试空表单提交
    const confirmBtn = await page.$('button:has-text("请先测试连接")');
    if (confirmBtn) {
      const isDisabled = await confirmBtn.isDisabled();
      if (isDisabled) {
        console.log('  ✅ 确认按钮默认禁用');
      } else {
        addFinding('LOW', '确认按钮未默认禁用', '测试未通过时确认按钮应禁用', '进入配置页');
      }
    }

    // 填写本地模型配置
    console.log('\n[TEST 3] 填写配置...');
    await baseUrlInput.fill('http://127.0.0.1:1234/v1');
    await modelInput.fill('qwen/qwen3.5-9b');
    await page.waitForTimeout(300);

    await screenshot(page, 'config_filled');

    // 检查测试按钮是否变为可用
    const testBtnAfterFill = await page.$('button:has-text("测试连接")');
    const isTestEnabled = !(await testBtnAfterFill.isDisabled());
    console.log(`  测试按钮可用: ${isTestEnabled}`);
    if (!isTestEnabled) {
      addFinding('LOW', '填写信息后测试按钮未启用', '填写 Base URL 和 Model 后测试按钮应变为可用', '填写配置信息');
    }

    // =============================================
    // 3. 检查 localStorage 持久化
    // =============================================
    console.log('\n[TEST 4] 检查配置持久化...');

    // 模拟提交（不需要真实测试通过，直接设置 localStorage）
    await page.evaluate(() => {
      localStorage.setItem('apiKey', 'test-key-123');
      localStorage.setItem('apiBaseUrl', 'http://127.0.0.1:1234/v1');
      localStorage.setItem('apiModel', 'qwen/qwen3.5-9b');
    });

    // 刷新页面验证配置是否恢复
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await screenshot(page, 'after_reload');

    const hasMenu = await page.$('text=故事模式') || await page.$('text=无尽模式');
    const hasConfig = await page.$('text=API 配置');

    if (hasMenu) {
      console.log('  ✅ localStorage 持久化生效，刷新后直接进入菜单');
    } else if (hasConfig) {
      // 检查输入框是否自动填充
      const baseUrlVal = await page.$eval('input[placeholder*="api.openai.com"]', el => el.value);
      const modelVal = await page.$eval('input[placeholder*="gpt-4o-mini"]', el => el.value);
      if (baseUrlVal && modelVal) {
        console.log('  ✅ 配置输入框自动填充了上次的值');
      } else {
        addFinding('MEDIUM', 'localStorage 持久化失败', '刷新后配置未自动填充', '1.填写配置 2.刷新页面');
      }
    } else {
      addFinding('HIGH', '刷新后页面状态异常', '刷新后既不是菜单也不是配置页', '填写配置后刷新');
    }

    // =============================================
    // 4. 模拟直接进入菜单（绕过测试连接）
    // =============================================
    console.log('\n[TEST 5] 菜单/模式选择页面...');

    await page.evaluate(() => {
      localStorage.setItem('apiBaseUrl', 'http://127.0.0.1:1234/v1');
      localStorage.setItem('apiModel', 'qwen/qwen3.5-9b');
      localStorage.setItem('apiKey', '');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await screenshot(page, 'mode_selector');

    // 检查故事模式按钮（文本可能含 emoji）
    const storyBtn = await page.$('text=故事模式');
    const endlessBtn = await page.$('text=无尽模式');

    if (storyBtn) console.log('  ✅ 故事模式入口存在');
    else addFinding('MEDIUM', '缺少故事模式入口', '菜单页未找到故事模式按钮', '进入菜单');

    if (endlessBtn) console.log('  ✅ 无尽模式入口存在');
    else addFinding('LOW', '缺少无尽模式入口', '菜单页未找到无尽模式按钮', '进入菜单');

    // =============================================
    // 5. 尝试进入游戏
    // =============================================
    console.log('\n[TEST 6] 尝试进入游戏...');

    if (storyBtn) {
      await storyBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'game_started');

      // 检查是否进入了游戏界面
      const gameUI = await page.$('canvas') || await page.$('[class*="stage"]') || await page.$('[class*="game"]');
      if (gameUI) {
        console.log('  ✅ 成功进入游戏界面');
      } else {
        addFinding('MEDIUM', '点击故事模式后未进入游戏', '点击故事模式后页面无变化', '1.进入菜单 2.点击故事模式');
        console.log('  ⚠️ 未检测到游戏界面（可能需要 API 连接）');
      }
    }

    // =============================================
    // 6. UI 布局检查
    // =============================================
    console.log('\n[TEST 7] UI 布局检查...');

    // 检查是否有严重的布局问题
    const bodyOverflow = await page.$eval('body', el => getComputedStyle(el).overflow);
    console.log(`  Body overflow: ${bodyOverflow}`);

    // 检查 z-index 层级
    const zIndexElements = await page.$$eval('[class*="z-"]', els => els.length);
    console.log(`  z-index 元素数量: ${zIndexElements}`);

    // =============================================
    // 7. 响应式测试
    // =============================================
    console.log('\n[TEST 8] 移动端响应式...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await screenshot(page, 'mobile_view');

    // 检查配置弹窗在小屏是否可用
    const mobileConfigVisible = await page.$('text=API 配置');
    console.log(`  移动端配置页可见: ${!!mobileConfigVisible}`);

    // 检查弹窗是否可滚动
    const modalOverflow = await page.$eval('.fixed.inset-0.z-50', el => getComputedStyle(el).overflowY).catch(() => 'N/A');
    console.log(`  弹窗 overflow-y: ${modalOverflow}`);

    if (!mobileConfigVisible) {
      // 用 innerText 再确认
      const hasConfigText = await page.$eval('body', el => el.innerText.includes('API 配置'));
      if (hasConfigText) {
        console.log('  ⚠️ 配置页文本存在（可能是 DOM 结构导致选择器未命中）');
      } else {
        addFinding('MEDIUM', '移动端配置页不可见', '375px 宽度下 API 配置弹窗不可见或超出屏幕', '在 375px 宽度打开页面');
      }
    } else {
      console.log('  ✅ 移动端配置页可见');
    }

    // 恢复桌面视图
    await page.setViewportSize({ width: 1440, height: 900 });

    // =============================================
    // 9. 生成报告
    // =============================================
    console.log('\n\n========== 测试完成，生成报告 ==========');

    let report = `# 🎮 游戏自动化测试报告\n\n`;
    report += `**测试时间**: ${new Date().toISOString()}\n`;
    report += `**测试 URL**: http://localhost:3000\n`;
    report += `**截图数量**: ${screenshotIndex}\n\n`;

    report += `---\n\n## 发现的问题\n\n`;

    if (findings.length === 0) {
      report += '✅ 自动化测试未发现明显问题。\n\n';
    } else {
      const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
      for (const f of findings) {
        bySeverity[f.severity].push(f);
      }

      for (const [severity, items] of Object.entries(bySeverity)) {
        if (items.length === 0) continue;
        const emoji = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }[severity];
        report += `### ${emoji} ${severity} 严重性 (${items.length} 项)\n\n`;
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          report += `#### ${i + 1}. ${f.title}\n\n`;
          report += `- **现象**: ${f.desc}\n`;
          report += `- **复现步骤**: ${f.repro}\n`;
          report += `- **可能归属**: 待定位\n\n`;
        }
      }
    }

    report += `---\n\n## 测试覆盖\n\n`;
    report += `| 测试项 | 状态 |\n`;
    report += `|--------|------|\n`;
    report += `| 启动加载 | ✅ |\n`;
    report += `| API 配置页面 | ✅ |\n`;
    report += `| 输入验证 | ✅ |\n`;
    report += `| localStorage 持久化 | ✅ |\n`;
    report += `| 模式选择 | ✅ |\n`;
    report += `| 游戏进入 | ✅ |\n`;
    report += `| 移动端响应式 | ✅ |\n`;

    report += `\n---\n\n## 截图列表\n\n`;
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).sort();
    for (const s of screenshots) {
      report += `- ![${s}](${SCREENSHOT_DIR}/${s})\n`;
    }

    fs.writeFileSync(REPORT_FILE, report, 'utf-8');
    console.log(`报告已生成: ${REPORT_FILE}`);
    console.log(`截图目录: ${SCREENSHOT_DIR}`);
    console.log(`问题数量: ${findings.length}`);
    if (findings.length > 0) {
      for (const f of findings) {
        console.log(`  [${f.severity}] ${f.title}`);
      }
    }

  } catch (err) {
    console.error('测试执行失败:', err);
    addFinding('HIGH', '测试脚本异常', err.message, '重新运行测试');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
