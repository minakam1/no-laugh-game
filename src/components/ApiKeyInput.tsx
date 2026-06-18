// ============================================================
// ApiKeyInput — API 配置 + 连通性测试（赛博朋克直播控制台风格）
// ============================================================

import { useState } from 'react';
import { HoverTranslate } from './HoverTranslate';
import { getSoundManager } from '@/audio/SoundManager';

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsImages: boolean;
}

interface ApiKeyInputProps {
  onConfirm: (config: ApiConfig) => void;
  savedConfig?: Partial<ApiConfig>;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

const LOCAL_DEFAULTS = {
  baseUrl: 'http://127.0.0.1:1234/v1',
  model: 'google/gemma-3-4b',
};

const DEEPSEEK_DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
};

export function ApiKeyInput({ onConfirm, savedConfig }: ApiKeyInputProps) {
  const sound = getSoundManager();
  const [apiKey, setApiKey] = useState(savedConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(savedConfig?.baseUrl || LOCAL_DEFAULTS.baseUrl);
  const [model, setModel] = useState(savedConfig?.model || LOCAL_DEFAULTS.model);
  const [supportsImages, setSupportsImages] = useState(savedConfig?.supportsImages || false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');
  const [testResult, setTestResult] = useState('');

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      setTestError('请先输入 API Base URL');
      setTestStatus('failed');
      return;
    }
    if (!model.trim()) {
      setTestError('请先输入模型名称');
      setTestStatus('failed');
      return;
    }

    setTestStatus('testing');
    setTestError('');
    setTestResult('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const isLocal = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
      const apiUrl = isLocal
        ? '/api/chat/completions'
        : `${baseUrl.replace(/\/$/, '')}/chat/completions`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model.trim(),
          messages: [{ role: 'user', content: '回复"OK"' }],
          max_tokens: 5,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let errMsg = `HTTP ${response.status}`;
        if (response.status === 401) errMsg = 'API Key 无效，请检查';
        else if (response.status === 403) errMsg = 'API Key 无权限，请检查';
        else if (response.status === 404) errMsg = '模型不存在或 URL 错误';
        else if (response.status === 429) errMsg = '请求频率超限，请稍后重试';
        else if (errText) errMsg = errText.slice(0, 100);
        throw new Error(errMsg);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '';

      if (reply) {
        setTestStatus('success');
        setTestResult(`[ SIGNAL OK ] 模型响应: "${reply}"`);
      } else {
        setTestStatus('success');
        setTestResult('[ SIGNAL OK ] 连接正常');
      }
    } catch (err: unknown) {
      setTestStatus('failed');
      if (err instanceof DOMException && err.name === 'AbortError') {
        setTestError('连接超时（15秒），请检查 URL');
      } else if (err instanceof TypeError) {
        setTestError('网络连接失败，请检查 API Base URL');
      } else if (err instanceof Error) {
        setTestError(err.message);
      } else {
        setTestError('未知错误');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!baseUrl.trim()) { setTestError('请输入 API Base URL'); return; }
    if (!model.trim()) { setTestError('请输入模型名称'); return; }
    if (testStatus !== 'success') {
      setTestError('请先点击"测试信号"验证配置');
      return;
    }

    const config: ApiConfig = {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim().replace(/\/$/, ''),
      model: model.trim(),
      supportsImages,
    };

    if (config.apiKey) sessionStorage.setItem('apiKey', config.apiKey);
    else sessionStorage.removeItem('apiKey');
    localStorage.removeItem('apiKey');
    localStorage.setItem('apiKeyHint', config.apiKey ? config.apiKey.slice(-4) : '');
    localStorage.setItem('apiBaseUrl', config.baseUrl);
    localStorage.setItem('apiModel', config.model);
    localStorage.setItem('apiSupportsImages', String(config.supportsImages));
    onConfirm(config);
  };

  const statusColor = {
    idle: 'text-game-text-dim',
    testing: 'text-warning',
    success: 'text-success',
    failed: 'text-danger',
  }[testStatus];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-3 py-4 md:py-6 relative">
      {/* 扫描线背景 */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      <div className="cyber-panel cyber-corner max-w-lg w-full mx-auto p-5 md:p-7 animate-fade-in relative z-10">
        <div className="panel-pattern" aria-hidden="true" />
        <div className="corner-brackets hidden sm:block" aria-hidden="true" />
        {/* 顶部装饰条 */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
        <div className="status-icon absolute top-4 right-4 hidden sm:inline-flex" aria-hidden="true">
          ANT
        </div>
        <div className="absolute top-11 right-5 hidden sm:flex items-end gap-0.5 pointer-events-none opacity-60" aria-hidden="true">
          {[8, 12, 16, 20].map((height) => (
            <span
              key={height}
              className="block w-1 bg-accent-tertiary/60"
              style={{ height }}
            />
          ))}
        </div>

        {/* 标题区 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <h2 className="font-cyber text-xl font-bold text-accent tracking-widest">
              SIGNAL CONFIG
            </h2>
          </div>
          <p className="text-sm text-game-text-dim font-data">
            // 配置直播信号源，建立与人类质检员的神经网络连接
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 快速配置：本地模型 */}
          <div className="flex gap-2" data-tutorial="config-quick-btns">
            <button
              type="button"
              onClick={() => {
                sound.play('ui_button_press');
                setBaseUrl(LOCAL_DEFAULTS.baseUrl);
                setModel(LOCAL_DEFAULTS.model);
                setApiKey('');
                setSupportsImages(false);
              }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group flex-1 py-1.5 border border-accent/40 text-[10px] font-cyber text-accent
                         hover:bg-accent/10 transition-all tracking-wider"
            >
              <HoverTranslate text="◈ LOCAL LLM" hoverText="◈ 本地模型" />
            </button>
            <button
              type="button"
              onClick={() => {
                sound.play('ui_button_press');
                setBaseUrl(DEEPSEEK_DEFAULTS.baseUrl);
                setModel(DEEPSEEK_DEFAULTS.model);
                setApiKey('');
                setSupportsImages(false);
              }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group flex-1 py-1.5 border border-accent/40 text-[10px] font-cyber text-accent
                         hover:bg-accent/10 transition-all tracking-wider"
            >
              <HoverTranslate text="◈ DEEPSEEK" hoverText="◈ 深度求索" />
            </button>
            <button
              type="button"
              onClick={() => {
                sound.play('ui_button_press');
                setBaseUrl('');
                setModel('');
                setApiKey('');
                setSupportsImages(false);
              }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group flex-1 py-1.5 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent-secondary/40 hover:text-accent-secondary transition-all tracking-wider"
            >
              <HoverTranslate text="◈ CUSTOM API" hoverText="◈ 自定义" />
            </button>
          </div>

          {/* API Base URL */}
          <div>
            <label className="cyber-label block mb-2">
              &gt;&gt; API BASE URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1 或 http://127.0.0.1:1234/v1"
              className="cyber-input w-full rounded-none"
            />
            <p className="mt-1.5 text-xs text-game-text-dim/60 font-data">
              [INFO] 支持 OpenAI 兼容接口；DeepSeek 使用 https://api.deepseek.com
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="cyber-label block mb-2">
              &gt;&gt; API KEY <span className="text-game-text-dim font-normal">[本地模型可留空]</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="你的 API Key"
                className="cyber-input w-full rounded-none pr-16"
              />
              <button
                type="button"
                onClick={() => { sound.play('ui_button_press'); setShowKey(!showKey); }}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group absolute right-0 top-0 bottom-0 px-4 text-game-text-dim font-cyber text-[10px]
                           hover:text-accent transition-colors border-l border-game-border"
                tabIndex={-1}
              >
                {showKey ? (
                  <HoverTranslate text="HIDE" hoverText="隐藏" />
                ) : (
                  <HoverTranslate text="SHOW" hoverText="显示" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-game-text-dim/60 font-data">
              [SECURE] Key 仅保存在当前标签页；生产模式可由云函数环境变量托管
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="cyber-label block mb-2">
              &gt;&gt; MODEL ID
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如: gpt-4o-mini"
              className="cyber-input w-full rounded-none"
            />
            <p className="mt-1.5 text-xs text-game-text-dim/60 font-data">
              [SUPPORTED] gpt-4o-mini / deepseek-v4-flash / deepseek-v4-pro / qwen-turbo / glm-4-flash / google/gemma-3-4b
            </p>
          </div>

          {/* Image support */}
          <label className="flex items-start gap-3 border border-game-border/70 px-4 py-3 cursor-pointer hover:border-accent/50 transition-colors">
            <input
              type="checkbox"
              checked={supportsImages}
              onChange={(e) => setSupportsImages(e.target.checked)}
              className="mt-1 accent-cyan-400"
            />
            <span>
              <span className="cyber-label block">&gt;&gt; SUPPORTS IMAGE INPUT</span>
              <span className="mt-1 block text-xs text-game-text-dim/60 font-data">
                [INFO] 勾选后会把表演前后截图作为 image_url 发送；DeepSeek 请保持关闭
              </span>
            </span>
          </label>

          {/* 测试按钮 */}
          <div>
            <button
              type="button"
              onClick={() => { sound.play('ui_button_press'); handleTest(); }}
              onMouseEnter={() => testStatus !== 'testing' && sound.play('ui_button_hover')}
              disabled={testStatus === 'testing' || !baseUrl.trim() || !model.trim()}
              className="group cyber-btn w-full disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">◈</span> SIGNAL TESTING...
                </span>
              ) : (
                <HoverTranslate text="◈ TEST SIGNAL" hoverText="◈ 测试信号" />
              )}
            </button>

            {/* 测试结果 */}
            {testStatus !== 'idle' && (
              <div
                className={`mt-3 px-4 py-3 border font-data text-sm ${
                  testStatus === 'success'
                    ? 'border-success/40 bg-success/5'
                    : testStatus === 'testing'
                      ? 'border-warning/40 bg-warning/5'
                      : 'border-danger/40 bg-danger/5'
                }`}
              >
                {testError ? (
                  <p className={statusColor}>[ ERROR ] {testError}</p>
                ) : testResult ? (
                  <p className={statusColor}>{testResult}</p>
                ) : null}
              </div>
            )}
          </div>

          {/* 确认按钮 */}
          <button
            type="submit"
            onMouseEnter={() => testStatus === 'success' && sound.play('ui_button_hover')}
            disabled={testStatus !== 'success'}
            className="group cyber-btn cyber-btn-pink w-full disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {testStatus === 'success' ? (
              <HoverTranslate text="◈ ENTER LIVE STAGE" hoverText="◈ 进入直播舞台" />
            ) : (
              'PLEASE TEST SIGNAL FIRST'
            )}
          </button>
        </form>

        {/* 底部装饰 */}
        <div className="mt-6 pt-4 border-t border-game-border flex items-center justify-between">
          <span className="font-data text-[10px] text-game-text-dim tracking-wider">
            SYS_VER: 2.0.77 // CYBER_PUNK_EDITION
          </span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <span className="font-data text-[10px] text-accent">ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
