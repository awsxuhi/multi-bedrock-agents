export enum ModelProvider {
  ANTHROPIC = "anthropic",
  AMAZON = "amazon",
  DEEPSEEK = "deepseek",
}

export enum ModelType {
  FOUNDATION = "foundation",
  EMBEDDING = "embedding",
}

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  type: ModelType;
  version: string;
  description: string;
}

export class ModelRegistry {
  private static models: Record<string, ModelConfig> = {
    // Anthropic Claude系列
    "claude-3-7-sonnet": {
      id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
      provider: ModelProvider.ANTHROPIC,
      type: ModelType.FOUNDATION,
      version: "3-7-sonnet-20250219-v1:0",
      description: "Claude 3.7 Sonnet - Latest sonnet model",
    },
    "claude-3-5-sonnet": {
      id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      provider: ModelProvider.ANTHROPIC,
      type: ModelType.FOUNDATION,
      version: "3-5-sonnet-20241022-v2:0",
      description: "Claude 3.5 Sonnet - Balanced performance",
    },
    "claude-3-haiku": {
      id: "anthropic.claude-3-haiku-20240307-v1:0",
      provider: ModelProvider.ANTHROPIC,
      type: ModelType.FOUNDATION,
      version: "3-haiku-20240307-v1:0",
      description: "Claude 3 Haiku - Fast and efficient",
    },

    // Amazon Nova系列
    "nova-pro": {
      id: "amazon.nova-pro-v1:0",
      provider: ModelProvider.AMAZON,
      type: ModelType.FOUNDATION,
      version: "pro-v1:0",
      description: "Amazon Nova Pro - High capability model",
    },
    "nova-lite": {
      id: "amazon.nova-lite-v1:0",
      provider: ModelProvider.AMAZON,
      type: ModelType.FOUNDATION,
      version: "lite-v1:0",
      description: "Amazon Nova Lite - Efficient model",
    },

    // DeepSeek系列
    "deepseek-r1": {
      id: "deepseek.r1-v1:0",
      provider: ModelProvider.DEEPSEEK,
      type: ModelType.FOUNDATION,
      version: "r1-v1:0",
      description: "DeepSeek R1 - General purpose model",
    },

    // 嵌入模型
    "titan-embedding": {
      id: "amazon.titan-embed-text-v2:0",
      provider: ModelProvider.AMAZON,
      type: ModelType.EMBEDDING,
      version: "v2:0",
      description: "Amazon Titan Text Embeddings",
    },
  };

  public static getModel(key: string): ModelConfig {
    if (!this.models[key]) {
      throw new Error(`Model ${key} not found in registry`);
    }
    return this.models[key];
  }

  public static getModelId(key: string): string {
    return this.getModel(key).id;
  }

  // 获取特定类型的所有模型
  public static getModelsByType(type: ModelType): Record<string, ModelConfig> {
    const result: Record<string, ModelConfig> = {};

    Object.entries(this.models).forEach(([key, model]) => {
      if (model.type === type) {
        result[key] = model;
      }
    });

    return result;
  }

  // 获取特定提供商的所有模型
  public static getModelsByProvider(provider: ModelProvider): Record<string, ModelConfig> {
    const result: Record<string, ModelConfig> = {};

    Object.entries(this.models).forEach(([key, model]) => {
      if (model.provider === provider) {
        result[key] = model;
      }
    });

    return result;
  }
}
