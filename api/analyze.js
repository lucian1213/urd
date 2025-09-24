// api/analyze.js
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '텍스트가 필요합니다.' });
    }
    
    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `당신은 텍스트가 응원의 의미를 담고 있는지 판별하는 전문가입니다. 
            
입력된 텍스트를 분석해서:
- 응원, 격려, 지지, 위로의 의미가 담겨있으면 true
- 그렇지 않으면 false로 답변해주세요.

응원글의 특징:
- 긍정적인 감정 전달 (화이팅, 파이팅, 힘내세요 등)
- 격려와 지지 (잘할 수 있어, 괜찮아, 수고했어 등)
- 위로와 공감 (힘들겠지만, 이해해, 함께해 등)
- 미래에 대한 희망적 메시지 (잘 될 거야, 해낼 수 있어 등)

답변은 반드시 JSON 형식으로 해주세요:
{"isEncouragement": true/false, "reason": "판별 이유를 한국어로"}`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      console.error('OpenAI API Error:', response.status, response.statusText);
      
      // API 실패시 키워드 기반 대체 분석
      const fallbackResult = fallbackAnalysis(text);
      return res.json(fallbackResult);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // JSON 파싱 시도
    try {
      const result = JSON.parse(aiResponse);
      return res.json(result);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      // 파싱 실패시 대체 분석
      const fallbackResult = fallbackAnalysis(text);
      return res.json(fallbackResult);
    }
    
  } catch (error) {
    console.error('서버 오류:', error);
    
    // 오류 발생시 대체 분석
    const fallbackResult = fallbackAnalysis(req.body.text || '');
    return res.json(fallbackResult);
  }
}

// API 실패시 대체 분석 함수 (키워드 기반)
function fallbackAnalysis(text) {
  const encouragementKeywords = [
    '화이팅', '파이팅', '힘내', '잘할', '할수있어', '할 수 있어', '응원', 
    '좋아', '멋져', '최고', '대단해', '훌륭해', '잘했어', '수고했어',
    '고생했어', '괜찮아', '충분해', '괜찮을', '잘될', '성공', '해낼',
    '사랑해', '믿어', '자랑스러워', '든든해', '함께', '지지해', '응원해',
    '희망', '꿈', '목표', '이룰', '극복', '견뎌', '버텨', '포기하지마',
    '할수있다', '잘하고있어', '최선', '노력', '열심히', '화이트'
  ];

  const negativeKeywords = [
    '싫어', '짜증', '화나', '스트레스', '우울', '절망', '포기', '실패',
    '못해', '안돼', '어려워', '힘들어', '피곤', '지쳐'
  ];
  
  const lowerText = text.toLowerCase().replace(/\s/g, '');
  
  // 응원 키워드 개수 계산
  const encouragementCount = encouragementKeywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // 부정 키워드 개수 계산  
  const negativeCount = negativeKeywords.filter(keyword =>
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // 응원글 판별 로직
  const isEncouragement = encouragementCount > 0 && (encouragementCount >= negativeCount);
  
  return {
    isEncouragement: isEncouragement,
    reason: isEncouragement 
      ? `응원 관련 키워드 ${encouragementCount}개 발견 (${encouragementKeywords.filter(k => lowerText.includes(k.toLowerCase())).join(', ')})`
      : `응원 키워드가 충분하지 않거나 부정적 표현이 포함됨 (응원: ${encouragementCount}개, 부정: ${negativeCount}개)`,
    method: "키워드 기반 분석 (OpenAI API 오류로 인한 대체)"
  };
}
