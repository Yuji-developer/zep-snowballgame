/******************************************
 * SnowBattle 2025 – Full Tournament Edition
 * リスポーン無し / スポーン地点無し
 * 赤青自動分け / 3ラウンド先取
 ******************************************/

const MAX_HP = 3;
const MAX_AMMO = 3;
const THROW_CD = 600;
const ROUND_TIME = 120000; // 2分
const MAX_ROUNDS = 5;      // BO5
const WIN_SCORE = 3;

let toggleTeam = true; // 赤→青→赤→青
let gameRunning = false;
let roundActive = false;
let roundEndTime = 0;
let currentRound = 1;

let scoreRed = 0;
let scoreBlue = 0;

// プレイヤーデータ
const P = {};  // id -> {hp, ammo, team, alive, lastThrow, kills, deaths}


//==============================
// プレイヤー初期化
//==============================
function ensurePlayer(p) {
  if (!P[p.id]) {
    P[p.id] = {
      hp: MAX_HP,
      ammo: MAX_AMMO,
      team: toggleTeam ? "red" : "blue",
      alive: true,
      lastThrow: 0,
      kills: 0,
      deaths: 0
    };
    toggleTeam = !toggleTeam;
  }
  return P[p.id];
}


//==============================
// UI表示
//==============================
function showUI(p) {
  const d = ensurePlayer(p);

  const hpBar = "❤️".repeat(d.hp) + "🤍".repeat(MAX_HP - d.hp);
  const ammoBar = "❄️".repeat(d.ammo) + "🤍".repeat(MAX_AMMO - d.ammo);

  const remain = Math.max(0, Math.floor((roundEndTime - Date.now()) / 1000));

  const teamLabel = d.team === "red" ? "🔴 RED" : "🔵 BLUE";

  p.showCustomLabel(
    `Round ${currentRound}/5　  ${scoreRed} : ${scoreBlue}\n`
    + `${teamLabel}\n`
    + `HP: ${hpBar}　Ammo: ${ammoBar}\n`
    + `K:${d.kills} / D:${d.deaths}　 Time:${remain}s`,
    0xffffff,
    0x000000,
    -40,
    200,
    0.6,
    500
  );
}


//==============================
// 雪玉投げ (Z)
//==============================
function throwBall(p) {
  const d = ensurePlayer(p);
  if (!d.alive) return;

  // ... (省略) ...

  if (d.ammo <= 0) {
    p.showCenterLabel("❄️  弾がありません！  Kで補給", 0xffffff, 0x000000, 0, 800);
    return;
  }
  d.ammo--;

  App.spawnProjectile(p, {
    type: "custom",
    image: "snowball.png", 
    scale: 0.40,
    speed: 11,
    gravity: true,
    onHit: hit => {
      if (hit?.targetPlayer) onHitPlayer(p, hit.targetPlayer);
    }
  });

  showUI(p);
}


//==============================
// 被弾処理
//==============================
function onHitPlayer(attacker, target) {
  const A = ensurePlayer(attacker);
  const T = ensurePlayer(target);

  if (!A.alive || !T.alive) return;

  T.hp--;

  if (T.hp <= 0) {
    T.alive = false;
    T.deaths++;
    A.kills++;

    target.kill();
    target.showCenterLabel("⚡ 脱落！", 0xffffff, 0x000000, 0, 800);
  }

  showUI(attacker);
  showUI(target);
}


//==============================
// 補給 (K)
//==============================
function refill(p) {
  const d = ensurePlayer(p);
  if (!d.alive) return;

  if (d.ammo >= MAX_AMMO) {
    p.showCenterLabel("🧊 もう満タン！", 0xffffff, 0x000000, 0, 800);
    return;
  }

  d.ammo = MAX_AMMO;

  p.showCenterLabel("🧊 補給完了！", 0xffffff, 0x000000, 0, 800);
  showUI(p);
}


//==============================
// ラウンド開始
//==============================
function startRound() {
  roundActive = true;
  roundEndTime = Date.now() + ROUND_TIME;

  App.sayToAll(`🎄 Round ${currentRound} START!`, 0xffffff);

  App.players.forEach(p => {
    P[p.id] = {
      hp: MAX_HP,
      ammo: MAX_AMMO,
      team: P[p.id] ? P[p.id].team : (toggleTeam ? "red" : "blue"),
      alive: true,
      lastThrow: 0,
      kills: P[p.id] ? P[p.id].kills : 0,
      deaths: P[p.id] ? P[p.id].deaths : 0
    };
    toggleTeam = !toggleTeam;

    showUI(p);
  });
}


//==============================
// 勝敗判定（1ラウンド）
//==============================
function checkRoundEnd() {
  let redAlive = 0;
  let blueAlive = 0;

  App.players.forEach(p => {
    const d = P[p.id];
    if (!d) return;
    if (!d.alive) return;

    if (d.team === "red") redAlive++;
    else blueAlive++;
  });

  // 全滅チェック
  if (redAlive === 0 || blueAlive === 0) {
    endRound();
  }
}


//==============================
// ラウンド終了
//==============================
function endRound() {
  if (!roundActive) return;
  roundActive = false;

  let redAlive = 0;
  let blueAlive = 0;

  App.players.forEach(p => {
    const d = P[p.id];
    if (d && d.alive) {
      if (d.team === "red") redAlive++;
      else blueAlive++;
    }
  });

  let winner = "draw";

  if (redAlive > blueAlive) {
    scoreRed++;
    winner = "red";
  } else if (blueAlive > redAlive) {
    scoreBlue++;
    winner = "blue";
  }

  if (winner === "red") {
    App.sayToAll("🔴 RED TEAM WINS THE ROUND!", 0xff0000);
  } else if (winner === "blue") {
    App.sayToAll("🔵 BLUE TEAM WINS THE ROUND!", 0x00aaff);
  } else {
    App.sayToAll("⚔️ DRAW!", 0xffffff);
  }

  // マッチ終了？
  if (scoreRed >= WIN_SCORE || scoreBlue >= WIN_SCORE) {
    declareMatchWinner();
    return;
  }

  currentRound++;
  App.runLater(() => {
    startRound();
  }, 2);
}


//==============================
// 最終勝利チーム
//==============================
function declareMatchWinner() {
  gameRunning = false;

  let winnerText =
    scoreRed > scoreBlue
      ? "🏆 🔴 RED TEAM WINS THE MATCH!"
      : "🏆 🔵 BLUE TEAM WINS THE MATCH!";

  App.sayToAll(winnerText, 0xffff00);

  // MVP（最多キル）
  let mvp = null;
  let maxKills = -1;

  App.players.forEach(p => {
    const d = P[p.id];
    if (d && d.kills > maxKills) {
      maxKills = d.kills;
      mvp = p;
    }
  });

  if (mvp) {
    App.sayToAll(`⭐ MVP: ${mvp.name} (${maxKills} Kills)`, 0xffff00);
  }
}


//==============================
// 初期化
//==============================
App.onStart.Add(function() {
  gameRunning = true;
  currentRound = 1;
  scoreRed = 0;
  scoreBlue = 0;

  startRound();
});


//==============================
// 毎フレーム更新
//==============================
let uiTimer = 0;
App.onUpdate.Add(function(dt) {
  if (!gameRunning) return;

  uiTimer += dt;

  if (roundActive) {
    if (Date.now() > roundEndTime) endRound();
    checkRoundEnd();
  }

  if (uiTimer > 200) {
    App.players.forEach(showUI);
    uiTimer = 0;
  }
});


//==============================
// キー入力
//==============================

// Z
App.addOnKeyDown(90, function(p) {
  if (!roundActive) return;
  throwBall(p);
});

// K
App.addOnKeyDown(75, function(p) {
  if (!roundActive) return;
  refill(p);
});
