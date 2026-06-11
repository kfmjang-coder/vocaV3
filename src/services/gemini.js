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
    '문장이 있으면 핵심 단어 단위로 분리해서 추출해줘.',
    '중복 단어는 한 번만 포함하고, 영어 단어는 기본형(원형)으로 정리해줘.',
    '반드시 아래 JSON 배열 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마:',
    '[{"english":"apple","korean":"사과"},{"english":"run","korean":"달리다; 운영하다"}]'
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
      korean: String(w.korean).trim()
    }));
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
