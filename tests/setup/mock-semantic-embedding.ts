// tests/setup/mock-semantic-embedding.ts
// 追加: 外部 API 呼び出しを行わずダミーのベクトルを返す埋め込みサービスモック

export class MockSemanticEmbeddingService {
  private static _instance: MockSemanticEmbeddingService;

  private constructor() {
    /* singleton */
  }

  static getInstance(): MockSemanticEmbeddingService {
    if (!this._instance) {
      this._instance = new MockSemanticEmbeddingService();
    }
    return this._instance;
  }

  /**
   * 疑似埋め込みを返す (固定長 128 の 0 ベクトル)
   */
  async embed(_text: string): Promise<number[]> {
    return new Array(128).fill(0);
  }

  /**
   * 疑似類似度 (常に 0.5)
   */
  async similarity(_vec1: number[], _vec2: number[]): Promise<number> {
    return 0.5;
  }
}

export const embeddingService = MockSemanticEmbeddingService.getInstance();

export default { MockSemanticEmbeddingService, embeddingService }; 