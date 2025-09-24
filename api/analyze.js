// api/analyze.js (개선된 버전)
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
            content: `당신은 텍스트의 진정한 의도를 파악하는 응원글 분석 전문가입니다.

**응원글 판별 기준:**

🎯 **응원글로 분류할 것:**
1. 다른 사람의 성공/성취를 바라는 마음 ("다른 사람들은 꼭 성공했으면", "모두가 잘되길")
2. 희망적인 미래를 그리는 표현 ("꼭 잘 될 거야", "운명을 바꿔줬으면")
3. 위로와 공감 ("힘들겠지만", "이해해", "함께해")
4. 격려와 지지 ("할 수 있어", "화이팅", "응원해", "믿어")
5. 긍정적 감정 전달 ("자랑스러워", "멋져", "대단해")
6. 과거의 실패를 언급하더라도 미래에 대한 희망이 담긴 경우

🚫 **응원글이 아닌 것:**
1. 단순한 일상 대화나 질문 ("뭐해?", "밥 먹었어?")
2. 부정적이고 절망적인 내용만 있는 경우 ("다 망했어", "포기해")
3. 비판이나 비난 ("못해", "바보야", "실망이야")
4. 무관한 정보나 사실 나열

**중요한 판별 원칙:**
- 부정적 단어가 포함되어도 전체적인 의도가 응원/격려라면 응원글로 판단
- "우리는 못했지만 다른 사람들은 성공하길"과 같은 표현은 희생적 응원의 의미로 해석
- 문맥과 전체적인 톤을 종합적으로 고려
- 애매한 경우엔 응원의 의도가 조금이라도 있으면 응원글로 분류

**예시:**
✅ "우리는 하지 못했지만, 다른 사람들은 꼭 운명을 바꿔줬으면 좋겠어" → 응원글 (희생적 응원)
✅ "힘들겠지만 포기하지 마" → 응원글 (위로+격려)
✅ "너라면 할 수 있어" → 응원글 (격려)
❌ "오늘 점심 뭐 먹을까?" → 응원글 아님 (일상 대화)
❌ "다 포기하고 싶어 죽겠네" → 응원글 아님 (절망적 표현)

답변 형식: {"isEncouragement": true/false, "reason": "상세한 판별 이유를 한국어로"}`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 300,
        temperature: 0.2
      })
    });
    
    if (!response.ok) {
      console.error('OpenAI API Error:', response.status, response.statusText);
      
      // API 실패시 개선된 키워드 기반 대체 분석
      const fallbackResult = improvedFallbackAnalysis(text);
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
      // 파싱 실패시 개선된 대체 분석
      const fallbackResult = improvedFallbackAnalysis(text);
      return res.json(fallbackResult);
    }
    
  } catch (error) {
    console.error('서버 오류:', error);
    
    // 오류 발생시 개선된 대체 분석
    const fallbackResult = improvedFallbackAnalysis(req.body.text || '');
    return res.json(fallbackResult);
  }
}

// 개선된 키워드 기반 대체 분석
function improvedFallbackAnalysis(text) {
  const encouragementKeywords = [
    // 직접적 응원
    '화이팅', '파이팅', '힘내', '응원', '지지', '격려',
    
    // 능력에 대한 믿음
    '할수있어', '할 수 있어', '해낼', '이룰', '성공', '잘할', '가능해',
    
    // 긍정적 평가
    '좋아', '멋져', '최고', '대단해', '훌륭해', '잘했어', '자랑스러워', '믿어',
    
    // 위로와 공감
    '괜찮아', '이해해', '함께', '든든', '위로', '공감',
    
    // 미래에 대한 희망
    '잘될', '좋아질', '나아질', '극복', '버텨', '견뎌', '꿈', '희망', '기대',
    
    // 타인의 성공을 바라는 마음
    '다른사람', '다른이', '모두가', '모든이', '다들', '바꿔', '성취', '이뤘으면', '되길'
  ];

  // 절대적 부정 키워드 (이것들만 있으면 응원글 아님)
  const absoluteNegativeKeywords = [
    '바보', '멍청', '쓰레기', '죽어', '꺼져', '싫어', '미워', '증오'
  ];

  // 문맥적 부정 키워드 (다른 긍정적 내용과 함께 있으면 괜찮음)
  const contextualNegativeKeywords = [
    '못해', '안돼', '실패', '포기', '힘들어', '어려워', '우울', '슬퍼'
  ];
  
  const lowerText = text.toLowerCase().replace(/\s/g, '');
  
  // 절대적 부정 키워드 확인
  const hasAbsoluteNegative = absoluteNegativeKeywords.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (hasAbsoluteNegative) {
    return {
      isEncouragement: false,
      reason: "비난이나 욕설이 포함되어 응원글이 아닙니다.",
      method: "개선된 키워드 분석 (OpenAI API 오류로 인한 대체)"
    };
  }
  
  // 응원 키워드 개수 계산
  const encouragementCount = encouragementKeywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // 문맥적 부정 키워드 개수
  const contextualNegativeCount = contextualNegativeKeywords.filter(keyword =>
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // 특별한 패턴 확인 ("다른 사람들은", "모두가" 등)
  const hasOthersSupport = /다른.*사람|다른.*이|모두|모든.*이|모든.*사람/.test(text);
  const hasFutureHope = /바꿔|잘.*될|좋.*될|성공|이뤄|희망|꿈/.test(text);
  
  // 개선된 판별 로직
  let isEncouragement = false;
  let reason = "";
  
  if (encouragementCount > 0) {
    isEncouragement = true;
    reason = `직접적인 응원 표현이 ${encouragementCount}개 발견되었습니다.`;
  } else if (hasOthersSupport && hasFutureHope) {
    isEncouragement = true;
    reason = "다른 사람의 성공을 바라는 희생적 응원의 의미가 담겨있습니다.";
  } else if (hasFutureHope && contextualNegativeCount <= 1) {
    isEncouragement = true;
    reason = "미래에 대한 희망적 메시지가 담겨있어 응원글로 판단됩니다.";
  } else if (contextualNegativeCount > encouragementCount && contextualNegativeCount > 2) {
    isEncouragement = false;
    reason = "부정적 표현이 주를 이뤄 응원글로 보기 어렵습니다.";
  } else {
    isEncouragement = false;
    reason = "응원이나 격려의 의미를 찾기 어려운 일반적인 텍스트입니다.";
  }
  
  return {
    isEncouragement: isEncouragement,
    reason: reason,
    method: "개선된 키워드 분석 (OpenAI API 오류로 인한 대체)"
  };
}
