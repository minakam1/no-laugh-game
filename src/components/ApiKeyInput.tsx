// ============================================================
// ApiKeyInput — API 配置 + 连通性测试（赛博朋克直播控制台风格）
// ============================================================

import { useState } from 'react';

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
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

export function ApiKeyInput({ onConfirm, savedConfig }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState(savedConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(savedConfig?.baseUrl || LOCAL_DEFAULTS.baseUrl);
  const [model, setModel] = useState(savedConfig?.model || LOCAL_DEFAULTS.model);
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
    };

    if (config.apiKey) sessionStorage.setItem('apiKey', config.apiKey);
    else sessionStorage.removeItem('apiKey');
    localStorage.removeItem('apiKey');
    localStorage.setItem('apiKeyHint', config.apiKey ? config.apiKey.slice(-4) : '');
    localStorage.setItem('apiBaseUrl', config.baseUrl);
    localStorage.setItem('apiModel', config.model);
    onConfirm(config);
  };

  const statusColor = {
    idle: 'text-game-text-dim',
    testing: 'text-warning',
    success: 'text-success',
    failed: 'text-danger',
  }[testStatus];

  return (
    <div className="h-full flex items-center justify-center overflow-y-auto">
      {/* 扫描线背景 */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      <div className="cyber-panel cyber-corner max-w-lg w-full mx-4 my-8 p-8 animate-fade-in relative z-10">
        {/* 顶部装饰条 */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />

        {/* 标题区 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <h2 className="font-cyber text-xl font-bold text-accent tracking-widest">
              SIGNAL CONFIG
            </h2>
          </div>
          <p className="text-sm text-game-text-dim font-data">
            // 配置直播信号源，建立与 AI 裁判的神经网络连接
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 快速配置：本地模型 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBaseUrl(LOCAL_DEFAULTS.baseUrl);
                setModel(LOCAL_DEFAULTS.model);
                setApiKey('');
              }}
              className="flex-1 py-1.5 border border-accent/40 text-[10px] font-cyber text-accent
                         hover:bg-accent/10 transition-all tracking-wider"
            >
              ◈ LOCAL LLM (127.0.0.1:1234)
            </button>
            <button
              type="button"
              onClick={() => {
                setBaseUrl('');
                setModel('');
                setApiKey('');
              }}
              className="flex-1 py-1.5 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent-secondary/40 hover:text-accent-secondary transition-all tracking-wider"
            >
              ◈ CUSTOM API
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
              [INFO] 需要包含 /v1 路径。支持 OpenAI 兼容接口
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
                onClick={() => setShowKey(!showKey)}
                className="absolute right-0 top-0 bottom-0 px-4 text-game-text-dim font-cyber text-[10px]
                           hover:text-accent transition-colors border-l border-game-border"
                tabIndex={-1}
              >
                {showKey ? 'HIDE' : 'SHOW'}
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
              [SUPPORTED] gpt-4o-mini / deepseek-chat / qwen-turbo / glm-4-flash / google/gemma-3-4b
            </p>
          </div>

          {/* 测试按钮 */}
          <div>
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus === 'testing' || !baseUrl.trim() || !model.trim()}
              className="cyber-btn w-full disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">◈</span> SIGNAL TESTING...
                </span>
              ) : (
                '◈ TEST SIGNAL'
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
            disabled={testStatus !== 'success'}
            className="cyber-btn cyber-btn-pink w-full disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {testStatus === 'success' ? '◈ ENTER LIVE STAGE' : 'PLEASE TEST SIGNAL FIRST'}
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
