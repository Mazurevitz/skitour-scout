/**
 * Settings Panel Component
 *
 * Configuration panel for LLM providers and preferences.
 */

import { useState, useEffect } from 'react';
import { Eye, EyeOff, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores';
import { LLMService, OPENROUTER_MODELS, RECOMMENDED_OLLAMA_MODELS } from '@/services';
import type { LLMProvider } from '@/types';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { config, updateConfig, saveLLMConfig } = useAppStore();

  // Local state for form
  const [provider, setProvider] = useState<LLMProvider>(config.llmProvider);
  const [ollamaUrl, setOllamaUrl] = useState(config.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(config.ollamaModel);
  const [openrouterKey, setOpenrouterKey] = useState(config.openrouterApiKey ?? '');
  const [openrouterModel, setOpenrouterModel] = useState(config.openrouterModel);
  const [showKey, setShowKey] = useState(false);

  // Status states
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Check Ollama status on mount and when URL changes
  useEffect(() => {
    const checkOllama = async () => {
      setOllamaStatus('checking');
      const llm = new LLMService({ ollamaUrl });
      const isOnline = await llm.checkOllamaHealth();
      setOllamaStatus(isOnline ? 'online' : 'offline');

      if (isOnline) {
        const models = await llm.listOllamaModels();
        setAvailableModels(models);
      }
    };

    if (provider === 'ollama') {
      checkOllama();
    }
  }, [provider, ollamaUrl]);

  const handleSave = () => {
    updateConfig({
      llmProvider: provider,
      ollamaUrl,
      ollamaModel,
      openrouterApiKey: openrouterKey || undefined,
      openrouterModel,
    });
    saveLLMConfig();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-mountain-dark rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* LLM Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              LLM Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProvider('ollama')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  provider === 'ollama'
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-white">Ollama</div>
                <div className="text-xs text-gray-400">Local, Free</div>
              </button>
              <button
                onClick={() => setProvider('openrouter')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  provider === 'openrouter'
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-white">OpenRouter</div>
                <div className="text-xs text-gray-400">API, Free tier</div>
              </button>
            </div>
          </div>

          {/* Ollama Configuration */}
          {provider === 'ollama' && (
            <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Ollama Status</span>
                <div className="flex items-center gap-2">
                  {ollamaStatus === 'checking' && (
                    <Loader2 size={14} className="text-blue-400 animate-spin" />
                  )}
                  {ollamaStatus === 'online' && (
                    <Check size={14} className="text-green-400" />
                  )}
                  {ollamaStatus === 'offline' && (
                    <AlertCircle size={14} className="text-red-400" />
                  )}
                  <span
                    className={`text-xs ${
                      ollamaStatus === 'online'
                        ? 'text-green-400'
                        : ollamaStatus === 'offline'
                          ? 'text-red-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {ollamaStatus === 'checking' ? 'Checking...' : ollamaStatus}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Model
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="llama3.2"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
                <div className="mt-1 text-xs text-gray-500">
                  Recommended: {RECOMMENDED_OLLAMA_MODELS.slice(0, 3).join(', ')}
                </div>
              </div>

              {ollamaStatus === 'offline' && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <div className="text-xs text-red-400">
                    Ollama not detected. Make sure Ollama is running:
                  </div>
                  <code className="block mt-1 text-xs text-gray-400 font-mono">
                    ollama serve
                  </code>
                </div>
              )}
            </div>
          )}

          {/* OpenRouter Configuration */}
          {provider === 'openrouter' && (
            <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  API Key
                </label>
                <div className="text-xs text-gray-500 mb-2">
                  Get a free key from{' '}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    openrouter.ai/keys
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    placeholder="sk-or-..."
                    className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-600 rounded"
                  >
                    {showKey ? (
                      <EyeOff size={16} className="text-gray-400" />
                    ) : (
                      <Eye size={16} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Model
                </label>
                <select
                  value={openrouterModel}
                  onChange={(e) => setOpenrouterModel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <optgroup label="Free Models">
                    {OPENROUTER_MODELS.filter((m) => m.free).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Paid Models">
                    {OPENROUTER_MODELS.filter((m) => !m.free).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {!openrouterKey && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                  <div className="text-xs text-yellow-400">
                    API key required for OpenRouter. Free tier available.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Region selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Region
            </label>
            <select
              value={config.region}
              onChange={(e) => updateConfig({ region: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <optgroup label="Beskidy">
                <option value="Beskid Śląski">Beskid Śląski (Skrzyczne, Pilsko, Rycerzowa)</option>
                <option value="Beskid Żywiecki">Beskid Żywiecki (Babia Góra)</option>
              </optgroup>
              <optgroup label="Tatry">
                <option value="Tatry">Tatry (Kasprowy, Rysy, Świnica)</option>
              </optgroup>
            </select>
            <div className="mt-1 text-xs text-gray-500">
              Routes and weather locations change per region
            </div>
          </div>

          {/* Refresh interval */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Auto-refresh Interval
            </label>
            <select
              value={config.refreshInterval}
              onChange={(e) =>
                updateConfig({ refreshInterval: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
              <option value="0">Manual only</option>
            </select>
          </div>
        </div>

        {/* Footer with save button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleSave}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
          <div className="mt-2 text-center text-xs text-gray-500">
            SkitourScout v0.1.0 • Settings stored locally
          </div>
        </div>
      </div>
    </div>
  );
}
