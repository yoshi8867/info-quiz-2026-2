/* 페이지 잠금 장치.
 *
 *   1겹  퍼즐 본문 ← 팀코드 + 입장코드
 *   2겹  다음 안내 ← 팀코드 + 정답
 *
 * 팀코드는 한 번 넣으면 이 태블릿에 기억된다. 다음 장소의 입장코드도 함께
 * 기억해 두어 그 페이지에서 자동으로 채워 준다 (기기 안에만 남는다).
 */
(function () {
  "use strict";

  var Y = window.ysbox;
  var $ = function (id) { return document.getElementById(id); };

  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function idx(team, pid) {
    return Y.hex(Y.sha256(Y.utf8(team + "|" + pid))).slice(0, 16);
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  var gate = $("gate"), puzzle = $("puzzle"), answer = $("answer"),
      solved = $("solved"), foot = $("foot");

  /* 다음 장소 카드에 적힌 입장코드를 기기에 저장 — 다음 페이지에서 자동 입력 */
  function rememberCodes(html) {
    var box = document.createElement("div");
    box.innerHTML = html;
    var cards = box.querySelectorAll("[data-goto]");
    for (var i = 0; i < cards.length; i++) {
      LS.set("ys.code." + cards[i].getAttribute("data-goto"),
             cards[i].getAttribute("data-code"));
    }
  }

  function reveal(html) {
    solved.innerHTML = html;
    show(solved);
    hide(answer);
    rememberCodes(html);
    solved.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── 2겹: 정답 ── */
  function trySolve(team, raw, quiet) {
    var a = Y.normAnswer(raw);
    if (!a) return false;
    var box = DATA.rkeys[idx(team, DATA.id)];
    var got = box ? Y.open(box, team + a, "k2|" + DATA.id) : null;
    if (!got) {
      if (!quiet) $("amsg").textContent = "아니다. 다시 보라.";
      return false;
    }
    var parsed = JSON.parse(got);
    var common = Y.open(DATA.reveal, parsed.k, "rv|" + DATA.id) || "";
    LS.set("ys.ans." + DATA.id, a);
    reveal(common + parsed.x);
    return true;
  }

  /* ── 1겹: 입장 ── */
  function tryEnter(team, code, quiet) {
    var secret = team + code;
    var box = DATA.keys[idx(team, DATA.id)];
    var pkey = box ? Y.open(box, secret, "k1|" + DATA.id) : null;
    if (!pkey) {
      if (!quiet) $("gmsg").textContent = "들어갈 수 없다. 팀코드와 입장코드를 확인하라.";
      return false;
    }

    puzzle.innerHTML = Y.open(DATA.body, pkey, "body|" + DATA.id) || "";
    show(puzzle);
    hide(gate);
    LS.set("ys.team", team);
    LS.set("ys.code." + DATA.id, code);

    if (DATA.open) {                       // 퀴즈 없는 방 (본관)
      reveal(Y.open(DATA.open[idx(team, DATA.id)], secret, "k0|" + DATA.id) || "");
      return true;
    }

    var prev = LS.get("ys.ans." + DATA.id);
    if (prev && trySolve(team, prev, true)) return true;

    show(answer);
    $("ans").focus();
    return true;
  }

  /* ── 연결 ── */
  /* 첫 방은 입장코드가 없다 — 팀코드만 넣고 시작한다 */
  var NOENTRY = !!DATA.noentry;
  if (NOENTRY) $("code").parentNode.hidden = true;

  $("enter").addEventListener("click", function () {
    $("gmsg").textContent = "";
    var team = Y.normCode($("team").value);
    var code = NOENTRY ? "" : Y.normCode($("code").value);
    if (!team) { $("gmsg").textContent = "팀코드를 넣어야 한다."; return; }
    if (!NOENTRY && !code) { $("gmsg").textContent = "입장코드를 넣어야 한다."; return; }
    tryEnter(team, code, false);
  });

  $("submit").addEventListener("click", function () {
    $("amsg").textContent = "";
    trySolve(Y.normCode($("team").value), $("ans").value, false);
  });

  ["team", "code"].forEach(function (id) {
    $(id).addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("enter").click();
    });
  });
  $("ans").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("submit").click();
  });

  /* ── 이미 왔던 팀이면 알아서 열어 준다 ── */
  var t = LS.get("ys.team") || "";
  var c = NOENTRY ? "" : (LS.get("ys.code." + DATA.id) || "");
  $("team").value = t;
  $("code").value = c;
  if (t && (c || NOENTRY)) tryEnter(t, c, true);
  if (!t) $("team").focus(); else if (!c && !NOENTRY) $("code").focus();

  foot.textContent = NOENTRY
    ? "팀코드는 이 태블릿에 기억된다. 다음 장소부터는 입장코드가 필요하다."
    : "팀코드는 이 태블릿에 기억된다. 입장코드는 팀마다 다르다.";
})();
