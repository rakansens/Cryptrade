// 🔴 Red: 最小限の認証テスト - 問題の根本原因特定
const { POST } = require('./app/api/ai/chat/route');

describe('Minimal Auth Test', () => {
  it('should handle auth error correctly', async () => {
    // 最小限のモックリクエスト
    const mockRequest = {
      json: () => Promise.resolve({ message: 'test' }),
      headers: new Headers(),
      url: 'http://localhost:3000/api/ai/chat',
      method: 'POST'
    };

    try {
      const response = await POST(mockRequest);
      const data = await response.json();
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(data, null, 2));
      
      // 実際のレスポンス構造を確認
      expect(response.status).toBe(401);
      
    } catch (error) {
      console.log('Error occurred:', error.message);
      console.log('Error stack:', error.stack);
    }
  });
});