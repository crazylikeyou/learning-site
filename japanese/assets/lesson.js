(function () {
  let japaneseVoice = null;

  function chooseJapaneseVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    japaneseVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("ja")) || null;
  }

  function speak(text) {
    if (!window.speechSynthesis) {
      window.alert("当前浏览器不支持语音播放，请改用 Chrome 或 Edge。");
      return;
    }
    chooseJapaneseVoice();
    if (!japaneseVoice) {
      window.alert("没有找到日语语音。请先在系统中安装日语语音包。");
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.voice = japaneseVoice;
    utter.rate = 0.86;
    speechSynthesis.speak(utter);
  }

  function renderQuiz(target, questions, advice) {
    const root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) return;
    root.innerHTML = "";

    const score = document.createElement("div");
    score.className = "score";
    score.hidden = true;
    score.innerHTML = '<strong class="score-text"></strong><p class="score-advice" style="margin:.6rem 0 0"></p>';

    let answered = 0;
    let correct = 0;
    const wrong = [];

    questions.forEach((q, qi) => {
      const box = document.createElement("div");
      box.className = "q";
      box.innerHTML = `<p><span class="mono">${String(qi + 1).padStart(2, "0")}</span>&nbsp; <span class="stem">${q.stem}</span></p>`;
      const ol = document.createElement("ol");
      ol.className = "opts";
      const why = document.createElement("p");
      why.className = "why";
      why.innerHTML = "<strong>为什么：</strong>" + q.why;

      q.opts.forEach((text, oi) => {
        const li = document.createElement("li");
        li.innerHTML = text;
        li.addEventListener("click", () => {
          if (box.dataset.done) return;
          box.dataset.done = "1";
          answered++;
          if (oi === q.answer) correct++; else wrong.push(qi + 1);
          [...ol.children].forEach((el, k) => {
            el.classList.add("locked");
            if (k === q.answer) el.classList.add("correct");
            else if (k === oi) el.classList.add("wrong");
          });
          why.classList.add("show");
          if (answered === questions.length) finish();
        });
        ol.appendChild(li);
      });

      box.appendChild(ol);
      box.appendChild(why);
      root.appendChild(box);
    });

    root.appendChild(score);

    function finish() {
      score.hidden = false;
      score.querySelector(".score-text").textContent = `答对 ${correct} / ${questions.length}`;
      const message = advice
        ? advice(correct, questions.length)
        : correct >= Math.ceil(questions.length * 0.8)
          ? "过关。下一步把规则放进完整句子，不继续堆孤立题。"
          : correct >= Math.ceil(questions.length * 0.6)
            ? "基本可用，但还不稳。只重做错题，并说出对应规则。"
            : "先停止做新题，回到本课例子，把每个错题对应的规则重新读一遍。";
      score.querySelector(".score-advice").textContent = message + (wrong.length ? ` 错题编号：${wrong.join("、")}。` : " 本轮全对。");
      score.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.addEventListener("click", function (event) {
      const button = event.target.closest("[data-say]");
      if (button) speak(button.dataset.say);
    });
    if (window.speechSynthesis) {
      chooseJapaneseVoice();
      speechSynthesis.onvoiceschanged = chooseJapaneseVoice;
    }
  });

  window.JapaneseLesson = { renderQuiz, speak };
})();

