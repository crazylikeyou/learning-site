(function () {
  "use strict";

  function renderQuiz(containerId, questions) {
    const quiz = document.getElementById(containerId);
    const score = document.getElementById("score");
    const scoreText = document.getElementById("scoreText");
    const advice = document.getElementById("advice");
    let answered = 0;
    let correct = 0;
    const wrong = [];

    questions.forEach(function (q, qi) {
      const box = document.createElement("div");
      box.className = "q";

      const stem = document.createElement("p");
      stem.innerHTML =
        '<span class="mono">' +
        String(qi + 1).padStart(2, "0") +
        "</span>&nbsp; <span class=\"stem\">" +
        q.stem +
        "</span>";
      box.appendChild(stem);

      const list = document.createElement("ol");
      list.className = "opts";

      q.opts.forEach(function (text, oi) {
        const item = document.createElement("li");
        item.innerHTML = text;
        item.addEventListener("click", function () {
          if (box.dataset.done === "1") return;
          box.dataset.done = "1";
          answered += 1;
          const isCorrect = oi === q.answer;
          if (isCorrect) correct += 1;
          else wrong.push(qi + 1);

          Array.from(list.children).forEach(function (element, index) {
            element.classList.add("locked");
            if (index === q.answer) element.classList.add("correct");
            else if (index === oi) element.classList.add("wrong");
          });

          why.classList.add("show");
          if (typeof window.renderMathInElement === "function") {
            renderMathInElement(box, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
              ],
              throwOnError: false
            });
          }
          if (answered === questions.length) finish();
        });
        list.appendChild(item);
      });

      const why = document.createElement("p");
      why.className = "why";
      why.innerHTML = "<strong>为什么：</strong>" + q.why;
      box.appendChild(list);
      box.appendChild(why);
      quiz.appendChild(box);
    });

    if (typeof window.renderMathInElement === "function") {
      renderMathInElement(quiz, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    }

    function finish() {
      score.hidden = false;
      scoreText.textContent = "答对 " + correct + " / " + questions.length;
      const ratio = correct / questions.length;
      let message;
      if (ratio < 0.5) {
        message = "先补矩阵乘法和行变换这两块地基，再进入综合题。";
      } else if (ratio < 0.75) {
        message = "主线可用，但题型识别还不稳。按错题所属模块补一讲。";
      } else if (ratio < 1) {
        message = "基础不错，主要检查符号、边界条件和过程完整性。";
      } else {
        message = "这一组全部正确。再挑一道完整计算题，确认不是靠排除法。";
      }
      advice.textContent =
        message +
        (wrong.length ? " 错题编号：" + wrong.join("、") + "。" : "");
    }
  }

  window.LAQuiz = { render: renderQuiz };
})();
