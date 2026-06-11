// Gemini API 호출 — 키는 AuthContext 메모리에서 전달받음
const endpoint = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function callGemini(gemini, body) {
  if (!gemini?.apiKey) throw new Error('NO_KEY');
  const res = await fetch(endpoint(gemini.model, gemini.apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('Gemini error', res.status, t);
    throw new Error('GEMINI_FAIL');
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

/** 이미지에서 영어 단어 전부 추출 + 한글 뜻 생성 (F1) */
export async function extractWords(gemini, base64, mimeType) {
  const prompt = [
    '이 이미지에서 영어 단어를 전부 찾아줘.',
    '각 단어에 대해 중학생 수준의 한국어 뜻을 1~2개 제공해줘 (여러 뜻은 세미콜론으로 구분).',
    '각 단어의 미국식 발음기호(IPA)도 슬래시로 감싸서 제공해줘.',
    '각 단어의 품사를 한글로 제공해줘 (명사/동사/형용사/부사/전치사/접속사/대명사/감탄사 중 하나).',
    '각 단어마다 중학교 2학년 수준의 짧고 쉬운 영어 예문(5~8단어)과 한국어 해석도 만들어줘.',
    '문장이 있으면 핵심 단어 단위로 분리해서 추출해줘.',
    '중복 단어는 한 번만 포함하고, 영어 단어는 기본형(원형)으로 정리해줘.',
    '반드시 아래 JSON 배열 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마:',
    '[{"english":"apple","korean":"사과","phonetic":"/ˈæpəl/","pos":"명사","example":"I eat an apple every day.","exampleKo":"나는 매일 사과를 먹어요."}]'
  ].join('\n');

  const text = await callGemini(gemini, {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.2, response_mime_type: 'application/json' }
  });

  const arr = parseJson(text);
  if (!Array.isArray(arr)) throw new Error('PARSE_FAIL');
  return arr
    .filter((w) => w.english && w.korean)
    .map((w) => ({
      english: String(w.english).trim().toLowerCase(),
      korean: String(w.korean).trim(),
      phonetic: w.phonetic ? String(w.phonetic).trim() : '',
      pos: w.pos ? String(w.pos).trim() : '',
      example: w.example ? String(w.example).trim() : '',
      exampleKo: w.exampleKo ? String(w.exampleKo).trim() : ''
    }));
}

/** 발음기호/품사/예문이 없는 기존 단어들 일괄 보충 (퀴즈 시작 시 backfill용) */
export async function fetchWordDetails(gemini, englishList) {
  if (!englishList.length) return {};
  const prompt = [
    `다음 영어 단어들에 대해 각각: 미국식 발음기호(IPA, 슬래시로 감싸기), 한글 품사(명사/동사/형용사/부사/전치사/접속사/대명사/감탄사 중 하나), 중학교 2학년 수준의 짧고 쉬운 영어 예문(5~8단어), 예문의 한국어 해석을 제공해줘: ${englishList.join(', ')}`,
    '반드시 아래 JSON 배열 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마:',
    '[{"english":"apple","phonetic":"/ˈæpəl/","pos":"명사","example":"I eat an apple every day.","exampleKo":"나는 매일 사과를 먹어요."}]'
  ].join('\n');
  try {
    const text = await callGemini(gemini, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, response_mime_type: 'application/json' }
    });
    const arr = parseJson(text);
    if (!Array.isArray(arr)) return {};
    const map = {};
    for (const w of arr) {
      if (!w.english) continue;
      map[String(w.english).trim().toLowerCase()] = {
        phonetic: w.phonetic ? String(w.phonetic).trim() : '',
        pos: w.pos ? String(w.pos).trim() : '',
        example: w.example ? String(w.example).trim() : '',
        exampleKo: w.exampleKo ? String(w.exampleKo).trim() : ''
      };
    }
    return map;
  } catch {
    return {}; // 실패해도 퀴즈는 정상 진행
  }
}

/** 듣고말하기 2차 의미 판정 (F3-④): 유의어도 정답 처리 */
export async function judgeMeaning(gemini, english, korean, userAnswer) {
  const prompt = [
    `영어 단어: "${english}"`,
    `사전 뜻: "${korean}"`,
    `학생의 답: "${userAnswer}"`,
    '학생의 답이 이 영어 단어의 뜻으로 의미상 맞으면 {"correct":true}, 틀리면 {"correct":false}.',
    '유의어, 비슷한 표현, 조사 차이는 정답으로 인정해. JSON으로만 응답해.'
  ].join('\n');

  try {
    const text = await callGemini(gemini, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, response_mime_type: 'application/json' }
    });
    const r = parseJson(text);
    return r?.correct === true;
  } catch {
    return false; // 판정 실패(오프라인 등) 시 1차 문자열 매칭 결과 유지
  }
}
