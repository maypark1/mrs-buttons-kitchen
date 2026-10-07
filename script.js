/* ─── KEYS ─── */
// Gemini(AI 레시피 생성)와 YouTube Data API를 쓰기 위한 API 키
// 실제 키는 config.js(깃허브에 올리지 않음)에서 불러옴 → config.example.js 참고
const GEMINI_KEY  = window.CONFIG?.GEMINI_KEY  || '';
const YOUTUBE_KEY = window.CONFIG?.YOUTUBE_KEY || '';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_KEY}`;
const YT_URL     = 'https://www.googleapis.com/youtube/v3/search';

/* ─── AUTH ─── */
// 로그인은 서버 없이 localStorage에 아이디만 저장하는 간단한 방식
function getUser() { return localStorage.getItem('loggedInUser'); }

// 로그인 여부에 따라 네비게이션 바를 갱신 (로그인 전: 로그인/회원가입, 로그인 후: 프로필/로그아웃)
function updateNavForAuth() {
  const user = getUser();
  document.getElementById('nav-login').style.display    = user ? 'none' : '';
  document.getElementById('nav-register').style.display = user ? 'none' : '';
  document.getElementById('nav-user').style.display     = user ? '' : 'none';
  document.getElementById('nav-logout').style.display   = user ? '' : 'none';
  if (user) {
    const photo = getProfile().photo;
    const avatarHtml = photo
      ? `<img src="${photo}" class="nav-avatar" alt="">`
      : '👤 ';
    document.getElementById('nav-user').innerHTML = avatarHtml + user;
  }
}

/* ─── PROFILE ─── */
// 프로필 정보(이름/이메일/지역/소개/사진)도 localStorage에 JSON으로 저장
function getProfile() { return JSON.parse(localStorage.getItem('userProfile') || '{}'); }
function setProfile(data) { localStorage.setItem('userProfile', JSON.stringify(data)); }

// 프로필 페이지 들어갈 때 저장된 정보를 입력 폼에 채워주기
function renderProfile() {
  const user    = getUser();
  const profile = getProfile();
  document.getElementById('profileId').value       = user || '';
  document.getElementById('profileName').value     = profile.name    || '';
  document.getElementById('profileEmail').value    = profile.email   || '';
  document.getElementById('profileRegion').value   = profile.region  || '';
  document.getElementById('profileBio').value      = profile.bio     || '';
  document.getElementById('profileSaveMsg').style.display = 'none';

  const img = document.getElementById('profilePhotoPreview');
  const placeholder = document.getElementById('profilePhotoPlaceholder');
  if (profile.photo) {
    img.src = profile.photo;
    img.classList.add('visible');
    placeholder.style.display = 'none';
  } else {
    img.classList.remove('visible');
    placeholder.style.display = '';
  }
}

// 저장 버튼 누르면 입력값들을 모아서 localStorage에 저장하고 완료 메시지 잠깐 보여주기
function saveProfile() {
  const profile = getProfile();
  profile.name   = document.getElementById('profileName').value.trim();
  profile.email  = document.getElementById('profileEmail').value.trim();
  profile.region = document.getElementById('profileRegion').value;
  profile.bio    = document.getElementById('profileBio').value.trim();
  setProfile(profile);
  updateNavForAuth();
  const msg = document.getElementById('profileSaveMsg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

// 프로필 사진 업로드: 선택한 이미지 파일을 base64 문자열로 변환해서 localStorage에 저장
// (서버가 없으니 파일을 그대로 둘 수 없어서 FileReader로 텍스트로 바꿔 저장하는 방식)
document.addEventListener('change', function(e) {
  if (e.target.id !== 'profilePhotoInput') return;
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const base64 = ev.target.result;
    const profile = getProfile();
    profile.photo = base64;
    setProfile(profile);
    const img = document.getElementById('profilePhotoPreview');
    const placeholder = document.getElementById('profilePhotoPlaceholder');
    img.src = base64;
    img.classList.add('visible');
    placeholder.style.display = 'none';
    updateNavForAuth();
  };
  reader.readAsDataURL(file);
});

function doLogout() {
  localStorage.removeItem('loggedInUser');
  updateNavForAuth();
  goPage('home');
}

/* ─── PAGE ─── */
// SPA(한 페이지짜리 사이트)라서 실제 이동 없이 .page 중 하나만 active 클래스로 보여주는 방식
function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  // 프로필 페이지는 nav-profile이 없고 nav-user(내 정보) 링크를 active 처리해야 함
  const navEl = document.getElementById(id === 'profile' ? 'nav-user' : 'nav-' + id);
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'saved') renderSaved();
  if (id === 'profile') renderProfile();
  if (id === 'login') {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginOk').style.display = 'none';
  }
}

/* ─── HOME ─── */
// 홈 화면의 추천 검색어(떡볶이, 김밥 등) 클릭하면 검색창에 채워주고 바로 검색
function quick(t) {
  document.getElementById('homeInput').value = t;
  doSearch();
}

function doSearch() {
  const q = document.getElementById('homeInput').value.trim();
  if (!q) return;
  fetchRecipeCards(q, 'homeResults', document.getElementById('homeSBtn'));
}

/* ─── EXPLORE ─── */
// 지역(나라) 필터를 고르면 그 아래에 세부 지역 태그를 보여주기 위한 데이터
const SUBREGIONS = {
  Korean:       ['서울', '부산', '경상도', '전라도', '제주', '강원도', '충청도'],
  Japanese:     ['도쿄', '오사카', '교토', '홋카이도', '규슈', '오키나와'],
  Chinese:      ['사천', '광동', '상해', '베이징', '후난', '신장'],
  Italian:      ['로마', '나폴리', '시칠리아', '밀라노', '토스카나', '베네토'],
  French:       ['파리', '프로방스', '리옹', '보르도', '노르망디', '알자스'],
  American:     ['뉴욕', '남부', '텍사스', '캘리포니아', '뉴올리언스', '시카고'],
  Mexican:      ['멕시코시티', '유카탄', '오악사카', '베라크루스', '바하'],
  Indian:       ['북인도', '남인도', '뭄바이', '라자스탄', '케랄라', '펀자브'],
  Thai:         ['방콕', '치앙마이', '이산', '남부 태국', '팟타이식'],
  Vietnamese:   ['하노이', '호치민', '후에', '다낭', '호이안'],
  Mediterranean:['그리스', '터키', '스페인', '모로코', '포르투갈'],
  MiddleEastern:['레바논', '이란', '이스라엘', '터키', '사우디', '이라크'],
};

// 같은 그룹(카테고리/식사 종류 등) 안에서는 하나만 선택되도록 토글
function toggleTag(el) {
  const wasSelected = el.classList.contains('selected');
  el.closest('.filter-tags').querySelectorAll('.filter-tag').forEach(t => t.classList.remove('selected'));
  if (!wasSelected) {
    el.classList.add('selected');
    // 카테고리 선택 시 지역 전체 해제
    if (el.dataset.group === 'category') {
      document.querySelectorAll('[data-cuisine]').forEach(t => t.classList.remove('selected'));
      updateSubregions();
    }
  }
}

// 지역(나라) 필터 선택 처리. 카테고리 필터와 동시에 쓰면 검색어가 너무 복잡해지니
// 둘 중 하나만 선택되게 막아줌
function toggleCuisine(el) {
  const wasSelected = el.classList.contains('selected');
  el.closest('.filter-tags').querySelectorAll('.filter-tag').forEach(t => t.classList.remove('selected'));
  if (!wasSelected) {
    el.classList.add('selected');
    // 지역 선택 시 카테고리 전체 해제
    document.querySelectorAll('[data-group="category"]').forEach(t => t.classList.remove('selected'));
  }
  updateSubregions();
}

// 선택된 지역(나라)에 맞는 세부 지역 태그들을 화면에 새로 그려줌
function updateSubregions() {
  const selected = [...document.querySelectorAll('[data-cuisine].selected')];
  const section = document.getElementById('subregionSection');

  if (!selected.length) {
    section.style.display = 'none';
    return;
  }

  const regions = selected.flatMap(el => SUBREGIONS[el.dataset.cuisine] || []);
  if (!regions.length) { section.style.display = 'none'; return; }

  const label = selected.map(el => el.textContent).join(' · ');
  document.getElementById('subregionLabel').textContent = `${label} 세부 지역`;
  document.getElementById('subregionTags').innerHTML = regions.map(r =>
    `<span class="filter-tag" data-query="${r}" onclick="toggleTag(this)">${r}</span>`
  ).join('');
  section.style.display = 'block';
}

// 체크된 필터 태그들을 전부 모아서 검색어 한 문장으로 합친 뒤 검색 실행
function doExplore() {
  const cuisineTags = [...document.querySelectorAll('[data-cuisine].selected')].map(t => t.dataset.query);
  const regionTags  = [...document.querySelectorAll('#subregionTags .filter-tag.selected')].map(t => t.dataset.query);
  const otherTags   = [...document.querySelectorAll('.filter-tag.selected:not([data-cuisine])')].filter(t => !t.closest('#subregionTags')).map(t => t.dataset.query);

  const all = [...regionTags, ...cuisineTags, ...otherTags];
  if (!all.length) {
    document.getElementById('exploreResults').innerHTML = `
      <div class="empty-zone"><span class="e-icon">👆</span>
      <p class="empty-title">필터를 하나 이상 선택해주세요</p></div>`;
    return;
  }
  fetchRecipeCards(all.join(' '), 'exploreResults', document.getElementById('exploreBtn'));
}

/* ─── DISCOVER ─── */
// "추천 받기" 버튼: 음식 종류 + 기분을 랜덤으로 골라서 Gemini한테 메뉴 하나를 추천받음
async function doDiscover() {
  const btn = document.getElementById('discoverBtn');
  const box = document.getElementById('discoverResults');
  btn.disabled = true;
  btn.textContent = '고르는 중...';
  box.innerHTML = `<div class="loading-zone"><img class="bunny-loading" src="bunny-icon.svg" alt="bunny">
    <p class="loading-msg">Mrs. Button이 골라주고 있어요...</p></div>`;

  const CUISINES = ['한식','일식','중식','이탈리아식','멕시코식','인도식','태국식','프랑스식','미국식','베트남식','터키식','스페인식'];
  const MOODS = ['든든한','가볍고 상큼한','매콤한','달콤한','시원한','따뜻한','고소한','새콤달콤한'];
  const randCuisine = CUISINES[Math.floor(Math.random() * CUISINES.length)];
  const randMood = MOODS[Math.floor(Math.random() * MOODS.length)];
  // seed 값을 매번 다르게 줘서 Gemini가 같은 음식만 계속 추천하는 걸 방지
  const randSeed = Math.floor(Math.random() * 10000);

  try {
    const res = await callGemini(`오늘 먹으면 맛있을 ${randMood} ${randCuisine} 음식 하나를 추천해주세요. (seed:${randSeed})
절대로 이전에 추천한 음식을 반복하지 마세요. 반드시 구체적인 단일 요리명을 선택하세요.
반드시 JSON만 반환: {"name":"한국어 음식 이름","emoji":"이모지","description":"한 줄 소개"}`);
    const data = await res.json();
    // Gemini 응답은 순수 JSON이 아니라 설명 텍스트에 JSON이 섞여올 수 있어서 정규식으로 {} 부분만 추출
    const m = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').match(/\{[\s\S]*\}/);
    const pick = m ? JSON.parse(m[0]) : { name: '비빔밥', emoji: '🍚', description: '' };

    box.innerHTML = `<div style="text-align:center;padding:1.5rem 2rem 2rem;">
      <span style="font-size:56px;">${pick.emoji}</span>
      <h2 style="font-family:'Caveat','Gaegu',cursive;font-size:2.4rem;margin:.75rem 0 .4rem;">${pick.name}</h2>
      <p style="font-family:'Quicksand','Gowun Dodum',sans-serif;font-size:17px;color:var(--muted);">${pick.description}</p>
    </div>`;

    // 추천받은 음식 이름으로 바로 레시피 카드까지 이어서 검색 (append=true로 위 추천 카드 아래에 추가)
    await fetchRecipeCards(pick.name, 'discoverResults', btn, true);
  } catch(e) {
    box.innerHTML = `<div class="empty-zone"><span class="e-icon">😔</span><p class="empty-title">문제가 발생했어요</p></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '추천 받기';
  }
}

/* ─── MAIN FETCH: YouTube + AI 혼합 ─── */
// 검색어 하나로 YouTube 영상 검색 + Gemini AI 레시피 생성을 같이 해서 카드로 보여주는 핵심 함수.
// 홈 검색, 탐색(필터) 검색, 추천 받기에서 전부 이 함수를 공통으로 사용함.
async function fetchRecipeCards(query, targetId, btn, append = false) {
  const box = document.getElementById(targetId);
  if (!append) {
    btn.disabled = true;
    btn._orig = btn.textContent;
    btn.textContent = '검색 중...';
    box.innerHTML = `<div class="loading-zone"><img class="bunny-loading" src="bunny-icon.svg" alt="bunny">
      <p class="loading-msg">Mrs. Button이 주방에서 찾고 있어요...</p>
      <p class="loading-sub">YouTube와 AI에서 레시피를 모으고 있어요</p></div>`;
  }

  let isRateLimit = false;
  try {
    // YouTube 한국어 + 영어 동시 검색 (한 언어로만 검색하면 결과가 한쪽으로 치우쳐서 둘 다 검색)
    const [koVids, enVids] = await Promise.all([
      searchYouTube(`${query} 레시피 만드는법`, 3),
      searchYouTube(`${query} recipe cooking`, 2)
    ]);

    // 두 검색 결과에 같은 영상이 중복으로 들어올 수 있어서 id 기준으로 한 번만 남기기
    const seen = new Set();
    let ytVideos = [...koVids, ...enVids].filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });

    // 결과가 많으면 한 채널 영상이 카드 목록을 다 차지하지 않도록 채널당 최대 2개로 제한
    if (ytVideos.length > 4) {
      const channelCount = {};
      ytVideos = ytVideos.filter(v => {
        channelCount[v.channel] = (channelCount[v.channel] || 0) + 1;
        return channelCount[v.channel] <= 2;
      });
    }
    ytVideos = ytVideos.slice(0, 4);
    // 영상 제목에 붙는 【필수】, [4K] 같은 꾸밈 표시는 잘라내서 카드에는 깔끔한 제목만 보이게
    ytVideos.forEach(v => {
      v.displayTitle = v.title.replace(/【[^】]*】|\[[^\]]*\]|[｜|].*/g, '').trim().slice(0, 30) || v.title.slice(0, 30);
    });

    // Gemini한테 같은 검색어로 스타일이 다른 AI 레시피 4개를 한번에 만들어달라고 요청
    const geminiPrompt = `당신은 레시피 전문가입니다.
"${query}" 요리의 뚜렷하게 다른 스타일 4가지 레시피 작성.
스타일: 지역별, 유명 셰프, 건강식, 퓨전 등 다양하게.
재료 계량은 큰술/작은술/컵/개 단위. g/ml 금지.
반드시 아래 JSON 형식만 반환 (마크다운 없이):
{
  "recipes": [
    {
      "style": "스타일명",
      "title": "레시피 제목",
      "emoji": "이모지 1개",
      "description": "특징 35자 이내",
      "time": "조리시간",
      "difficulty": "쉬움/보통/어려움",
      "servings": "2인분",
      "calories": "약 NNN kcal",
      "ingredients": ["재료 계량"],
      "steps": ["단계 설명"],
      "tip": "팁 한 문장",
      "nutrition": {"carbs":"NN g","protein":"NN g","fat":"NN g","sodium":"NNN mg"}
    }
  ]
}
ingredients 5~6개, steps 4~5개.`;

    // Gemini 호출은 따로 try/catch로 감싸서, AI 쪽이 실패해도 위에서 구한 YouTube 결과는 그대로 보여줌
    let aiRecipes = [];
    try {
      const gRes = await callGemini(geminiPrompt);
      if (gRes.ok) {
        const gData = await gRes.json();
        const txt = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) aiRecipes = JSON.parse(m[0]).recipes || [];
      }
    } catch(e) { /* AI 실패해도 YouTube는 표시 */ }

    // 카드 클릭했을 때 모달에서 어떤 데이터를 보여줄지 알아야 해서 전역에 잠깐 저장
    window._ytCards = ytVideos;
    window._aiCards = aiRecipes;

    if (!append) {
      renderMixedCards(query, ytVideos, aiRecipes, box);
    } else {
      const div = document.createElement('div');
      box.appendChild(div);
      renderMixedCards(query, ytVideos, aiRecipes, div);
    }
  } catch(e) {
    // YouTube 검색 자체가 실패했거나(거의 rate limit) Gemini가 너무 많이 호출돼서 막힌 경우
    if (e.message === 'rate_limit') {
      isRateLimit = true;
      box.innerHTML = `<div class="empty-zone"><span class="e-icon">⏳</span>
        <p class="empty-title">잠깐만요!</p>
        <p class="empty-sub">요청이 너무 많아요. 잠시 후 다시 시도해주세요.</p></div>`;
      startCooldown(btn);
    } else {
      if (!append) box.innerHTML = `<div class="empty-zone"><span class="e-icon">😔</span>
        <p class="empty-title">문제가 발생했어요</p><p class="empty-sub">다시 시도해주세요</p></div>`;
    }
  } finally {
    if (!isRateLimit) {
      btn.disabled = false;
      btn.textContent = btn._orig || '검색';
    }
  }
}

/* ─── YOUTUBE ─── */
// YouTube Data API의 search 엔드포인트로 영상 검색. 실패하면 빈 배열을 줘서
// 호출하는 쪽(fetchRecipeCards)이 따로 에러처리 안 해도 되게 함
async function searchYouTube(query, maxResults = 6) {
  const params = new URLSearchParams({
    part: 'snippet', q: query, type: 'video',
    maxResults, key: YOUTUBE_KEY,
    order: 'relevance'
  });
  try {
    const res = await fetch(`${YT_URL}?${params}`);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`YouTube API error ${res.status}:`, errText);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map(v => ({
      type: 'youtube',
      id: v.id.videoId,
      title: v.snippet.title,
      displayTitle: v.snippet.title,
      channel: v.snippet.channelTitle,
      thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.medium?.url,
      description: v.snippet.description,
      url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
      date: v.snippet.publishedAt.slice(0, 10)
    }));
  } catch(e) { return []; }
}

/* ─── EMOJI UTILS ─── */
// Gemini가 가끔 국기 이모지(🇰🇷 같은)를 골라줄 때가 있는데, 윈도우에서는 이게
// 이모지로 안 뜨고 "KR" 같은 글자 코드로 보여서 그런 경우 그냥 기본 음식 이모지로 대체
function safeEmoji(emoji) {
  if (!emoji) return '🍽️';
  // 국기 이모지 = Regional Indicator 2개 연속 (U+1F1E6–U+1F1FF)
  if (/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(emoji)) return '🍽️';
  return emoji;
}

/* ─── RENDER MIXED CARDS ─── */
// AI 레시피 카드 배경으로 쓸 그라데이션 색상 목록
const GRADIENTS = [
  'linear-gradient(135deg,#EDF5E6,#C8DEB8)',
  'linear-gradient(135deg,#F5EDE2,#E8D4B8)',
  'linear-gradient(135deg,#D8E8F2,#B8CEDE)',
  'linear-gradient(135deg,#F5E4D4,#E8C8B0)',
  'linear-gradient(135deg,#EDE8F5,#D0C4E8)',
  'linear-gradient(135deg,#F2F5D8,#D8E4A8)',
  'linear-gradient(135deg,#F5E8E4,#E8C4BC)',
];

// 레시피 제목 문자열을 숫자로 바꿔서(해시) 항상 같은 제목이면 같은 그라데이션이 나오게 함
// (그냥 랜덤으로 뽑으면 카드 다시 그릴 때마다 색이 바뀌어서 어색함)
function cardGradient(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xFF;
  return GRADIENTS[h % GRADIENTS.length];
}

// YouTube 영상 카드 + AI 레시피 카드를 함께 그려주는 함수.
// 둘 다 결과가 있으면 좌우로 나눠서(split), 한쪽만 있으면 그냥 한 줄 그리드로 보여줌
function renderMixedCards(query, ytVideos, aiRecipes, box) {
  const ytGrid = ytVideos.map((v, i) => `
    <article class="recipe-card" onclick="openYTMod(${i})">
      <div class="card-illustration" style="padding:0;overflow:hidden;">
        <img class="card-img" src="${v.thumbnail}" alt="${v.displayTitle}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-emoji-fallback" style="display:none">🎬</div>
        <span class="src-badge yt-badge">▶ YouTube</span>
        <button class="card-save-btn ${isSavedYT(v.id) ? 'saved' : ''}"
                onclick="event.stopPropagation();toggleSaveYT(this,${i})" aria-label="저장">♥</button>
      </div>
      <div class="card-body">
        <p class="card-source">${v.channel}</p>
        <h3 class="card-name">${v.displayTitle}</h3>
        <div class="card-meta"><span>${v.date}</span></div>
      </div>
    </article>`).join('');

  const aiGrid = aiRecipes.map((r, i) => `
    <article class="recipe-card" onclick="openAIMod(${i})">
      <div class="card-illustration" style="background:${cardGradient(r.title)}">
        <span class="card-emoji">${safeEmoji(r.emoji)}</span>
        <span class="src-badge ai-badge">${r.difficulty || '보통'}</span>
        <button class="card-save-btn ${isSavedAI(r.title) ? 'saved' : ''}"
                onclick="event.stopPropagation();toggleSaveAI(this,${i})" aria-label="저장">♥</button>
      </div>
      <div class="card-body">
        <p class="card-source" style="color:var(--sage-dk);">${r.style}</p>
        <h3 class="card-name">${r.title}</h3>
        <div class="card-meta">
          <span>${r.time || '—'}</span>
          <span>${r.calories || ''}</span>
        </div>
      </div>
    </article>`).join('');

  const hasYT = ytVideos.length > 0;
  const hasAI = aiRecipes.length > 0;

  box.innerHTML = `
    <p style="margin-bottom:1.5rem;font-family:'Quicksand','Gowun Dodum',sans-serif;font-size:14px;color:var(--muted);">
      "<em>${query}</em>" 검색 결과 ${ytVideos.length + aiRecipes.length}개
    </p>
    ${hasYT && hasAI ? `
    <div class="split-results">
      <div class="split-col">
        <p class="split-label">▶ YouTube</p>
        <div class="split-cards">${ytGrid}</div>
      </div>
      <div class="split-col">
        <p class="split-label">AI 레시피</p>
        <div class="split-cards">${aiGrid}</div>
      </div>
    </div>` : `
    ${hasYT ? `<p class="split-label">▶ YouTube</p><div class="recipes-grid">${ytGrid}</div>` : ''}
    ${hasAI ? `<p class="split-label">AI 레시피</p><div class="recipes-grid">${aiGrid}</div>` : ''}
    `}`;
}

/* ─── MODALS ─── */
// YouTube 카드 클릭 시 모달 띄우기. 영상 자체에는 레시피 텍스트가 없으니
// 영상 제목/채널/설명을 Gemini한테 넘겨서 레시피 형태로 정리해달라고 요청함
async function openYTMod(i) {
  const v = window._ytCards?.[i];
  if (!v) return;

  document.getElementById('mInner').innerHTML = `
    <div class="modal-top" style="height:240px;overflow:hidden;position:relative;">
      <img src="${v.thumbnail}" style="width:100%;height:100%;object-fit:cover;"
           onerror="this.style.display='none'">
      <button class="modal-close-btn" onclick="document.getElementById('mBg').classList.remove('open')">✕</button>
    </div>
    <div class="modal-content">
      <p class="modal-style-label">▶ ${v.channel} &nbsp;
        <a href="${v.url}" target="_blank" style="color:var(--warm-dk);text-decoration:none;">▶ YouTube에서 보기</a>
      </p>
      <h2 class="modal-dish-title">${v.displayTitle}</h2>
      <div id="recipeContent">
        <div class="loading-zone" style="padding:2rem 0;">
          <img class="bunny-loading" src="bunny-icon.svg" alt="bunny" style="width:32px;height:32px;">
          <p class="loading-msg" style="font-size:16px;">레시피를 정리하고 있어요...</p>
        </div>
      </div>
    </div>`;
  document.getElementById('mBg').classList.add('open');

  try {
    const prompt = `다음 YouTube 레시피 영상 정보를 바탕으로 레시피를 정리해주세요.
제목: ${v.title}
채널: ${v.channel}
설명: ${v.description || ''}

제목에서 요리명을 파악해서 실제 만들 수 있는 완전한 레시피를 작성하세요.
재료 계량은 큰술/작은술/컵/개 단위. g/ml 금지.
반드시 JSON만 반환:
{
  "dish": "요리 이름",
  "description": "특징 한 줄",
  "time": "조리시간",
  "difficulty": "쉬움/보통/어려움",
  "servings": "N인분",
  "ingredients": ["재료 계량"],
  "steps": ["단계 설명"],
  "tip": "팁",
  "nutrition": {"carbs":"NN g","protein":"NN g","fat":"NN g","sodium":"NNN mg"}
}
ingredients 6~8개, steps 5~6개.`;

    const res = await callGemini(prompt);
    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    const r = m ? JSON.parse(m[0]) : null;
    if (r) renderModalRecipe(r);
    // Gemini가 JSON을 못 만들었거나 실패한 경우엔 그냥 영상에서 직접 보라고 안내
    else document.getElementById('recipeContent').innerHTML =
      `<p style="color:var(--muted);font-style:italic;">영상에서 직접 확인해주세요.</p>`;
  } catch(e) {
    document.getElementById('recipeContent').innerHTML =
      `<p style="color:var(--muted);font-style:italic;">영상에서 직접 확인해주세요.</p>`;
  }
}

// AI 레시피 카드 클릭 시 모달 띄우기. 이쪽은 이미 카드에 레시피 데이터가 다 있어서
// 추가 API 호출 없이 바로 renderModalRecipeHTML로 상세 내용을 채움
function openAIMod(i) {
  const r = window._aiCards?.[i];
  if (!r) return;

  document.getElementById('mInner').innerHTML = `
    <div class="modal-top" style="background:${cardGradient(r.title)}">
      <span style="font-size:88px;line-height:1;">${safeEmoji(r.emoji)}</span>
      <button class="modal-close-btn" onclick="document.getElementById('mBg').classList.remove('open')">✕</button>
    </div>
    <div class="modal-content">
      <p class="modal-style-label">${r.style}</p>
      <div class="modal-title-row">
        <div>
          <h2 class="modal-dish-title">${r.title}</h2>
        </div>
        <button class="modal-save-btn ${isSavedAI(r.title) ? 'saved' : ''}" id="modalSaveBtn"
                onclick="toggleSaveAIByTitle('${r.title.replace(/'/g,"\\'")}',${i});updateModalSaveBtn('${r.title.replace(/'/g,"\\'")}')">
          ${isSavedAI(r.title) ? '♥ 저장됨' : '♡ 레시피 저장'}
        </button>
      </div>
      ${r ? renderModalRecipeHTML(r) : ''}
    </div>`;
  document.getElementById('mBg').classList.add('open');
}

function renderModalRecipe(r) {
  document.getElementById('recipeContent').innerHTML = renderModalRecipeHTML(r);
}

function renderModalRecipeHTML(r) {
  return `
    <p class="modal-desc">${r.description || ''}</p>
    <div class="modal-meta-row">
      <span>${r.time || '—'}</span>
      <span>${r.servings || '2인분'}</span>
      <span>${r.difficulty || '—'}</span>
      ${r.calories ? `<span>${r.calories}</span>` : ''}
    </div>
    <div class="modal-grid">
      <div>
        <p class="sec-title">재료</p>
        <ul class="ing-list">
          ${(r.ingredients || []).map(x => `<li>${x}</li>`).join('')}
        </ul>
      </div>
      <div>
        <p class="sec-title">조리 방법</p>
        <ol class="step-list">
          ${(r.steps || []).map(s => `<li>${s}</li>`).join('')}
        </ol>
        ${r.tip ? `<div class="tip-scroll"><p>${r.tip}</p></div>` : ''}
      </div>
    </div>
    ${r.nutrition ? `
    <table class="nutrition-table">
      <caption>영양 정보 (1인분 기준)</caption>
      <thead>
        <tr><th>칼로리</th><th>탄수화물</th><th>단백질</th><th>지방</th><th>나트륨</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${r.calories || '—'}</td>
          <td>${r.nutrition.carbs || '—'}</td>
          <td>${r.nutrition.protein || '—'}</td>
          <td>${r.nutrition.fat || '—'}</td>
          <td>${r.nutrition.sodium || '—'}</td>
        </tr>
      </tbody>
    </table>` : ''}`;
}

function updateModalSaveBtn(title) {
  const btn = document.getElementById('modalSaveBtn');
  if (!btn) return;
  const saved = isSavedAI(title);
  btn.textContent = saved ? '♥ 저장됨' : '♡ 레시피 저장';
  btn.classList.toggle('saved', saved);
}

// 모달 바깥의 어두운 배경 클릭하면 닫히게 (모달 내용 클릭은 무시)
function closeMod(e) {
  if (e.target === document.getElementById('mBg'))
    document.getElementById('mBg').classList.remove('open');
}

// ESC 키로도 모달 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('mBg').classList.remove('open');
});

// 페이지가 처음 열릴 때도 로그인 상태에 맞게 네비게이션 바를 한 번 맞춰줌
updateNavForAuth();

/* ─── GEMINI ─── */
// Gemini API 호출 공통 함수. 429(요청 너무 많음) 응답이 오면 잠깐 기다렸다가
// 점점 더 긴 간격으로 재시도하고(지수 백오프), 그래도 안 되면 rate_limit 에러를 던짐
async function callGemini(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
      })
    });
    if (res.status !== 429) return res;
    if (attempt < maxRetries - 1)
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
  }
  throw new Error('rate_limit');
}

// rate limit 걸렸을 때 버튼에 남은 대기시간을 보여주면서 60초 동안 못 누르게 막기
function startCooldown(btn) {
  let sec = 60;
  btn.disabled = true;
  btn.textContent = `${sec}초 대기`;
  const t = setInterval(() => {
    sec--;
    btn.textContent = `${sec}초 대기`;
    if (sec <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = btn._orig || '검색'; }
  }, 1000);
}

/* ─── SAVE (YouTube) ─── */
// 저장된 영상 목록을 localStorage에 배열로 보관 (id로 중복/저장여부 체크)
function getSavedYT() { return JSON.parse(localStorage.getItem('savedYT') || '[]'); }
function isSavedYT(id) { return getSavedYT().some(v => v.id === id); }

// 카드의 ♥ 버튼: 이미 저장돼 있으면 빼고, 아니면 추가 (찜하기 토글)
function toggleSaveYT(btn, i) {
  const v = window._ytCards?.[i];
  if (!v) return;
  const saved = getSavedYT();
  const idx = saved.findIndex(s => s.id === v.id);
  if (idx === -1) { saved.push(v); btn.classList.add('saved'); }
  else { saved.splice(idx, 1); btn.classList.remove('saved'); }
  localStorage.setItem('savedYT', JSON.stringify(saved));
}

/* ─── SAVE (AI) ─── */
function getSavedAI() { return JSON.parse(localStorage.getItem('savedAI') || '[]'); }
function isSavedAI(title) { return getSavedAI().some(r => r.title === title); }

function toggleSaveAI(btn, i) {
  const r = window._aiCards?.[i];
  if (!r) return;
  toggleSaveAIByTitle(r.title, i);
  btn.classList.toggle('saved', isSavedAI(r.title));
}

// 카드 클릭(인덱스 i)과 모달 안 저장 버튼(타이틀로 찾음) 양쪽에서 다 쓰는 공통 토글 함수.
// AI 레시피는 영상처럼 고유 id가 없어서 제목(title)을 기준으로 같은 레시피인지 판단함
function toggleSaveAIByTitle(title, i) {
  const saved = getSavedAI();
  const idx = saved.findIndex(r => r.title === title);
  const r = window._aiCards?.[i] || saved.find(r => r.title === title);
  if (idx === -1 && r) saved.push(r);
  else if (idx !== -1) saved.splice(idx, 1);
  localStorage.setItem('savedAI', JSON.stringify(saved));
}

/* ─── MEMO ─── */
// 저장한 레시피마다 메모를 남길 수 있게, "yt_영상id" / "ai_레시피제목"을 키로 써서
// 메모 전체를 객체 하나로 묶어 저장 (memos = { "yt_abc123": "다음에 만들 때 설탕 줄이기" ... })
function getMemos() { return JSON.parse(localStorage.getItem('recipeMemos') || '{}'); }
function saveMemo(key, text) {
  const memos = getMemos();
  if (text.trim()) memos[key] = text;
  else delete memos[key];
  localStorage.setItem('recipeMemos', JSON.stringify(memos));
}
function getMemo(key) { return getMemos()[key] || ''; }

/* ─── SAVED PAGE ─── */
// 저장됨 탭: localStorage에 저장해둔 YouTube/AI 레시피를 카드로 다시 그려줌
function renderSaved() {
  const savedYT = getSavedYT();
  const savedAI = getSavedAI();
  const box = document.getElementById('savedList');
  if (!box) return;

  if (!savedYT.length && !savedAI.length) {
    box.innerHTML = `<div class="empty-zone"><img class="e-icon" src="bunny-icon.svg" alt="bunny">
      <p class="empty-title">아직 저장한 레시피가 없어요</p>
      <p class="empty-sub">카드의 ♥를 눌러 저장해보세요</p></div>`;
    return;
  }

  window._ytCards = savedYT;
  window._aiCards = savedAI;

  const ytGrid = savedYT.map((v, i) => `
    <article class="recipe-card" onclick="openYTMod(${i})">
      <div class="card-illustration" style="padding:0;overflow:hidden;">
        <img class="card-img" src="${v.thumbnail}" alt="${v.displayTitle}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-emoji-fallback" style="display:none">🎬</div>
        <span class="src-badge yt-badge">▶ YouTube</span>
        <button class="saved-remove-btn"
                onclick="event.stopPropagation();removeSavedYT('${v.id}')" aria-label="삭제">✕</button>
      </div>
      <div class="card-body">
        <p class="card-source">${v.channel}</p>
        <h3 class="card-name">${v.displayTitle}</h3>
        <div class="memo-wrap" onclick="event.stopPropagation()">
          <label class="memo-label">내 메모</label>
          <textarea class="memo-area" placeholder="레시피 메모를 남겨보세요..."
            onchange="saveMemo('yt_${v.id}', this.value)">${getMemo('yt_' + v.id)}</textarea>
        </div>
      </div>
    </article>`).join('');

  const aiGrid = savedAI.map((r, i) => `
    <article class="recipe-card" onclick="openAIMod(${i})">
      <div class="card-illustration" style="background:${cardGradient(r.title)}">
        <span class="card-emoji">${safeEmoji(r.emoji)}</span>
        <span class="src-badge ai-badge">${r.difficulty || '보통'}</span>
        <button class="saved-remove-btn"
                onclick="event.stopPropagation();removeSavedAI('${r.title.replace(/'/g,"\\'")}')" aria-label="삭제">✕</button>
      </div>
      <div class="card-body">
        <p class="card-source" style="color:var(--sage-dk);">${r.style}</p>
        <h3 class="card-name">${r.title}</h3>
        <div class="memo-wrap" onclick="event.stopPropagation()">
          <label class="memo-label">내 메모</label>
          <textarea class="memo-area" placeholder="레시피 메모를 남겨보세요..."
            onchange="saveMemo('ai_${r.title.replace(/'/g,"\\'")}', this.value)">${getMemo('ai_' + r.title)}</textarea>
        </div>
      </div>
    </article>`).join('');

  box.innerHTML = `
    ${ytGrid ? `<p class="resource-label" style="margin-bottom:1rem;">▶ YouTube</p>
    <div class="recipes-grid" style="margin-bottom:2.5rem;">${ytGrid}</div>` : ''}
    ${aiGrid ? `<p class="resource-label" style="margin-bottom:1rem;">AI 레시피</p>
    <div class="recipes-grid">${aiGrid}</div>` : ''}`;
}

function removeSavedYT(id) {
  localStorage.setItem('savedYT', JSON.stringify(getSavedYT().filter(v => v.id !== id)));
  renderSaved();
}

function removeSavedAI(title) {
  localStorage.setItem('savedAI', JSON.stringify(getSavedAI().filter(r => r.title !== title)));
  renderSaved();
}

/* ─── REGISTER ─── */
// 입력 필드 하나를 검사 규칙(fn)으로 확인하고, 틀리면 빨간 테두리 + 에러 문구를 보여줌.
// 회원가입/로그인 폼에서 필드마다 이 함수를 재사용
function chk(id, errId, fn) {
  const el = document.getElementById(id);
  const er = document.getElementById(errId);
  const ok = fn(el.value);
  el.classList.toggle('err', !ok);
  er.classList.toggle('show', !ok);
  return ok;
}

// 회원가입 폼 검증: 모든 항목이 통과해야(every) 가입 처리. 서버가 없어서
// 그냥 아이디를 로그인 상태로 저장하는 수준의 간단한 가입 처리
function doRegister() {
  const ok = [
    chk('ri', 'ei', v => /^[a-zA-Z0-9]{4,12}$/.test(v)),
    chk('rp', 'ep', v => v.length >= 8),
    chk('rp2', 'ep2', v => v === document.getElementById('rp').value && v !== ''),
    chk('rn', 'en', v => v.trim().length > 0),
    chk('re', 'ee', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
  ].every(Boolean);

  if (ok) {
    localStorage.setItem('loggedInUser', document.getElementById('ri').value.trim());
    updateNavForAuth();
    document.getElementById('regForm').style.display = 'none';
    document.getElementById('regOk').style.display = 'block';
  }
}

// 로그인 폼 검증: 아이디/비밀번호가 비어있지 않은지만 확인 (서버 인증이 없으므로 가입할 때처럼
// 형식 검증까진 안 하고, 그냥 입력했는지만 체크)
function doLogin() {
  const ok = [
    chk('li', 'eli', v => v.trim().length > 0),
    chk('lp', 'elp', v => v.length > 0)
  ].every(Boolean);

  if (ok) {
    localStorage.setItem('loggedInUser', document.getElementById('li').value.trim());
    updateNavForAuth();
    goPage('home');
  }
}
