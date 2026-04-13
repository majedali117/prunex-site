/* ===================================================================
   PRUNEX — Assessment Engine
   State management, UI rendering, localStorage persistence.
   Depends on: PrunexScoring (scoring.js)
   =================================================================== */

(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────
  var LEAD_ENDPOINT = null; // Set to a URL to POST lead data; null = console.log
  var STORAGE_KEY = 'prunex_assessment_v1';
  var QUESTIONS_URL = '../resources/questions.json';

  // ── i18n Helper ──────────────────────────────────────────────────
  function t(key) {
    return window.i18n ? window.i18n.t(key) : key;
  }

  // ── State ────────────────────────────────────────────────────────
  var state = {
    phase: 1,
    intake: { industry: null, size: null, maturity: null },
    selected_frameworks: [],
    risk_class: null,
    classification_answers: { q1: null, q2: [], q3: null, q4: null, q5: null },
    answers: {},
    skipped: [],
    lead: { name: '', email: '', company: '', role: '' },
    completed_at: null,
  };

  var questionsData = null; // Full questions.json
  var filteredQuestions = []; // Questions after filtering
  var categories = []; // Ordered categories for current assessment
  var currentCategoryIndex = 0;
  var classifyStep = 0;
  var intakeStep = 0;

  // ── Intake Questions ─────────────────────────────────────────────
  function getIntakeQuestions() {
    return [
      {
        key: 'industry',
        question: t('assessment.intake_q1'),
        options: [
          { value: 'Healthcare / MedTech', label: t('assessment.intake_q1_o1') },
          { value: 'Financial Services', label: t('assessment.intake_q1_o2') },
          { value: 'Technology / SaaS', label: t('assessment.intake_q1_o3') },
          { value: 'Manufacturing / Industry', label: t('assessment.intake_q1_o4') },
          { value: 'Legal / Insurance', label: t('assessment.intake_q1_o5') },
          { value: 'Other', label: t('assessment.intake_q1_o6') },
        ],
      },
      {
        key: 'size',
        question: t('assessment.intake_q2'),
        options: [
          { value: '1-50', label: '1-50' },
          { value: '51-200', label: '51-200' },
          { value: '201-1000', label: '201-1000' },
          { value: '1000+', label: '1000+' },
        ],
      },
      {
        key: 'maturity',
        question: t('assessment.intake_q3'),
        options: [
          { value: 'Just starting: no formal policies', label: t('assessment.intake_q3_o1') },
          { value: 'Early stage: some policies exist but informal', label: t('assessment.intake_q3_o2') },
          { value: 'Developing: formal programme in place', label: t('assessment.intake_q3_o3') },
          { value: 'Advanced: certified or externally audited', label: t('assessment.intake_q3_o4') },
        ],
      },
    ];
  }

  function getClassifyQuestions() {
    return [
      {
        key: 'q1',
        question: t('assessment.classify_q1'),
        type: 'single',
        options: [
          { value: 'a', label: t('assessment.classify_q1_o1') },
          { value: 'b', label: t('assessment.classify_q1_o2') },
          { value: 'c', label: t('assessment.classify_q1_o3') },
          { value: 'd', label: t('assessment.classify_q1_o4') },
        ],
      },
      {
        key: 'q2',
        question: t('assessment.classify_q2'),
        type: 'multi',
        options: [
          { value: 'employment', label: t('assessment.classify_q2_o1') },
          { value: 'credit', label: t('assessment.classify_q2_o2') },
          { value: 'healthcare', label: t('assessment.classify_q2_o3') },
          { value: 'biometric', label: t('assessment.classify_q2_o4') },
          { value: 'law', label: t('assessment.classify_q2_o5') },
          { value: 'education', label: t('assessment.classify_q2_o6') },
          { value: 'infrastructure', label: t('assessment.classify_q2_o7') },
          { value: 'none', label: t('assessment.classify_q2_o8') },
        ],
      },
      {
        key: 'q3',
        question: t('assessment.classify_q3'),
        type: 'single',
        options: [
          { value: 'a', label: t('assessment.classify_q3_o1') },
          { value: 'b', label: t('assessment.classify_q3_o2') },
          { value: 'c', label: t('assessment.classify_q3_o3') },
          { value: 'd', label: t('assessment.classify_q3_o4') },
        ],
      },
      {
        key: 'q4',
        question: t('assessment.classify_q4'),
        type: 'single',
        options: [
          { value: 'a', label: t('assessment.classify_q4_o1') },
          { value: 'b', label: t('assessment.classify_q4_o2') },
          { value: 'c', label: t('assessment.classify_q4_o3') },
        ],
      },
      {
        key: 'q5',
        question: t('assessment.classify_q5'),
        type: 'single',
        options: [
          { value: 'a', label: t('assessment.classify_q5_o1') },
          { value: 'b', label: t('assessment.classify_q5_o2') },
          { value: 'c', label: t('assessment.classify_q5_o3') },
          { value: 'd', label: t('assessment.classify_q5_o4') },
        ],
      },
    ];
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function $(id) {
    return document.getElementById(id);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage unavailable
    }
  }

  function loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed && parsed.phase > 1 && !parsed.completed_at) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }

  function setPhase(phase) {
    state.phase = phase;
    saveState();
    // Hide all phases
    var phases = document.querySelectorAll('.assessment-phase');
    for (var i = 0; i < phases.length; i++) {
      phases[i].classList.remove('active');
    }
    $('phase-' + phase).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Initialise ───────────────────────────────────────────────────
  function init() {
    fetch(QUESTIONS_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(function (data) {
        questionsData = data;
        $('assess-loading').style.display = 'none';

        // Check for saved state
        var saved = loadState();
        if (saved) {
          state = saved;
          state.skipped = state.skipped || [];
        }

        // If there's a saved state, show resume banner
        if (saved && saved.phase > 1) {
          renderResumeBanner();
        }

        setPhase(1);
        bindPhase1();
        bindPhase3();
        bindPhase5Nav();
        bindPhase6();

        // Listen for language changes to re-render dynamic content
        document.addEventListener('languageChanged', function () {
          var activePhase = state.phase;
          // Re-render resume banner if on landing page
          if (activePhase === 1 && state.phase > 1) {
            renderResumeBanner();
          }
          // Also re-render the resume banner if it exists (phase > 1 in saved state)
          var resumeBanner = $('resume-banner');
          if (resumeBanner && resumeBanner.innerHTML.trim()) {
            renderResumeBanner();
          }
          if (activePhase === 2) renderIntakeStep();
          if (activePhase === 3) renderFrameworkGrid();
          if (activePhase === 4) renderClassifyStep();
          if (activePhase === 5) renderCurrentCategory();
          // Phase 6 (lead form) is handled by data-i18n attributes
          // Phase 7 (results) is finalized and doesn't need re-render
        });
      })
      .catch(function () {
        $('assess-loading').style.display = 'none';
        $('assess-error').style.display = 'block';
      });
  }

  // ── Phase 1: Landing ────────────────────────────────────────────
  function renderResumeBanner() {
    var frameworks = state.selected_frameworks.join(', ') || t('assessment.resume_no_fw');
    $('resume-banner').innerHTML =
      '<div class="resume-banner">' +
      '<div class="resume-banner-text">' +
      '<h3>' + t('assessment.resume_title') + '</h3>' +
      '<p>' + t('assessment.resume_desc') +
      (state.selected_frameworks.length ? ' (' + frameworks + ')' : '') +
      '.</p>' +
      '</div>' +
      '<div class="resume-banner-actions">' +
      '<button class="btn btn-primary" id="btn-resume">' + t('assessment.resume_btn') + '</button>' +
      '<button class="btn btn-ghost" id="btn-start-fresh">' + t('assessment.resume_fresh') + '</button>' +
      '</div>' +
      '</div>';

    $('btn-resume').addEventListener('click', function () {
      // Restore to saved phase
      if (state.phase === 5) {
        prepareQuestions();
      }
      setPhase(state.phase);
      if (state.phase === 2) renderIntakeStep();
      if (state.phase === 3) renderFrameworkGrid();
      if (state.phase === 4) renderClassifyStep();
      if (state.phase === 5) renderCurrentCategory();
    });

    $('btn-start-fresh').addEventListener('click', function () {
      clearState();
      state = {
        phase: 1,
        intake: { industry: null, size: null, maturity: null },
        selected_frameworks: [],
        risk_class: null,
        classification_answers: { q1: null, q2: [], q3: null, q4: null, q5: null },
        answers: {},
        skipped: [],
        lead: { name: '', email: '', company: '', role: '' },
        completed_at: null,
      };
      $('resume-banner').innerHTML = '';
    });
  }

  function bindPhase1() {
    $('btn-start-assessment').addEventListener('click', function () {
      intakeStep = 0;
      setPhase(2);
      renderIntakeStep();
    });
  }

  // ── Phase 2: Intake ─────────────────────────────────────────────
  function renderIntakeStep() {
    var INTAKE_QUESTIONS = getIntakeQuestions();
    var q = INTAKE_QUESTIONS[intakeStep];
    var currentVal = state.intake[q.key];
    var html =
      '<div class="intake-step-indicator">' + t('assessment.question') + ' ' +
      (intakeStep + 1) +
      ' ' + t('assessment.of') + ' ' +
      INTAKE_QUESTIONS.length +
      '</div>' +
      '<h2>' +
      q.question +
      '</h2>' +
      '<div class="intake-options" role="radiogroup" aria-label="' +
      q.question +
      '">';

    for (var i = 0; i < q.options.length; i++) {
      var opt = q.options[i];
      var optValue = opt.value || opt;
      var optLabel = opt.label || opt;
      var sel = currentVal === optValue ? ' selected' : '';
      html +=
        '<button class="intake-option' +
        sel +
        '" data-value="' +
        optValue +
        '" role="radio" aria-checked="' +
        (currentVal === optValue ? 'true' : 'false') +
        '" tabindex="0">' +
        '<div class="intake-option-radio"></div>' +
        '<span>' +
        optLabel +
        '</span>' +
        '</button>';
    }

    html += '</div>';
    html += '<div class="intake-nav">';
    if (intakeStep > 0) {
      html +=
        '<button class="btn btn-ghost" id="intake-back">' + t('assessment.back_arrow') + '</button>';
    }
    html += '</div>';

    $('intake-container').innerHTML = html;

    // Bind clicks
    var options = $('intake-container').querySelectorAll('.intake-option');
    for (var j = 0; j < options.length; j++) {
      options[j].addEventListener('click', function () {
        var val = this.getAttribute('data-value');
        state.intake[q.key] = val;
        saveState();

        // Update visuals
        var all = $('intake-container').querySelectorAll('.intake-option');
        for (var k = 0; k < all.length; k++) {
          all[k].classList.remove('selected');
          all[k].setAttribute('aria-checked', 'false');
        }
        this.classList.add('selected');
        this.setAttribute('aria-checked', 'true');

        // Auto-advance after short delay
        setTimeout(function () {
          if (intakeStep < getIntakeQuestions().length - 1) {
            intakeStep++;
            renderIntakeStep();
          } else {
            // Move to phase 3
            setPhase(3);
            renderFrameworkGrid();
          }
        }, 300);
      });
    }

    // Back button
    var backBtn = $('intake-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        intakeStep--;
        renderIntakeStep();
      });
    }
  }

  // ── Phase 3: Framework Selection ────────────────────────────────
  function renderFrameworkGrid() {
    var frameworks = questionsData.frameworks;
    var recommended = PrunexScoring.mapIndustryToRecommended(
      state.intake.industry
    );

    var html = '<div class="fw-grid">';

    for (var i = 0; i < frameworks.length; i++) {
      var fw = frameworks[i];
      var isSelected =
        state.selected_frameworks.indexOf(fw.name) !== -1;
      var isRecommended =
        recommended &&
        fw.recommended_for &&
        fw.recommended_for.indexOf(recommended) !== -1;
      var isDisabled =
        !isSelected && state.selected_frameworks.length >= 3;
      var classes = 'fw-card';
      if (isSelected) classes += ' selected';
      if (isDisabled) classes += ' disabled';

      // Use i18n for description, urgency, penalty (fallback to original)
      var fwDescKey = 'fw.' + fw.id + '.description';
      var fwUrgencyKey = 'fw.' + fw.id + '.urgency';
      var fwPenaltyKey = 'fw.' + fw.id + '.penalty';
      var fwDesc = t(fwDescKey);
      var fwUrgency = t(fwUrgencyKey);
      var fwPenalty = t(fwPenaltyKey);
      // Fallback to JSON data if key not found (t returns the key itself)
      if (fwDesc === fwDescKey) fwDesc = fw.description;
      if (fwUrgency === fwUrgencyKey) fwUrgency = fw.urgency;
      if (fwPenalty === fwPenaltyKey) fwPenalty = fw.penalty;

      html +=
        '<div class="' +
        classes +
        '" data-fw="' +
        fw.name +
        '" role="checkbox" aria-checked="' +
        (isSelected ? 'true' : 'false') +
        '" tabindex="0">' +
        '<div class="fw-card-header">' +
        '<span class="fw-card-name" style="color: ' +
        fw.color +
        ';">' +
        fw.name +
        '</span>' +
        '<div class="fw-card-check">' +
        (isSelected ? '✓' : '') +
        '</div>' +
        '</div>' +
        '<p class="fw-card-desc">' +
        fwDesc +
        '</p>' +
        '<div class="fw-card-tags">';

      if (isRecommended) {
        html +=
          '<span class="fw-tag fw-tag-recommended">' + t('assessment.fw_recommended') + '</span>';
      }
      html +=
        '<span class="fw-tag">' +
        fw.industry +
        '</span>' +
        '<span class="fw-tag">' +
        fw.region +
        '</span>' +
        '</div>' +
        '<div class="fw-card-urgency">⏱ ' +
        fwUrgency +
        '</div>' +
        '<div class="fw-card-penalty">' + t('assessment.fw_penalty_label') + ' ' +
        fwPenalty +
        '</div>' +
        '</div>';
    }

    html += '</div>';
    $('fw-grid-container').innerHTML = html;
    updateFwCount();

    // Bind card clicks
    var cards = document.querySelectorAll('.fw-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', handleFwCardClick);
      cards[j].addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleFwCardClick.call(this);
        }
      });
    }
  }

  function handleFwCardClick() {
    var name = this.getAttribute('data-fw');
    var idx = state.selected_frameworks.indexOf(name);

    if (idx !== -1) {
      state.selected_frameworks.splice(idx, 1);
    } else if (state.selected_frameworks.length < 3) {
      state.selected_frameworks.push(name);
    }
    saveState();
    renderFrameworkGrid();
  }

  function updateFwCount() {
    $('fw-count').textContent = state.selected_frameworks.length;
    $('btn-fw-next').disabled = state.selected_frameworks.length === 0;
  }

  function bindPhase3() {
    $('btn-fw-back').addEventListener('click', function () {
      intakeStep = getIntakeQuestions().length - 1;
      setPhase(2);
      renderIntakeStep();
    });

    $('btn-fw-next').addEventListener('click', function () {
      if (state.selected_frameworks.length === 0) return;

      // Check if EU AI Act is selected
      if (state.selected_frameworks.indexOf('EU AI Act') !== -1) {
        classifyStep = 0;
        setPhase(4);
        renderClassifyStep();
      } else {
        state.risk_class = null;
        prepareQuestions();
        setPhase(5);
        renderCurrentCategory();
      }
    });
  }

  // ── Phase 4: Classification Gate ────────────────────────────────
  function renderClassifyStep() {
    var CLASSIFY_QUESTIONS = getClassifyQuestions();
    var q = CLASSIFY_QUESTIONS[classifyStep];
    var currentVal = state.classification_answers[q.key];

    var html =
      '<div class="classify-step">' + t('assessment.classify_header') + ' ' +
      (classifyStep + 1) +
      ' ' + t('assessment.of') + ' ' +
      CLASSIFY_QUESTIONS.length +
      '</div>' +
      '<h2>' +
      q.question +
      '</h2>' +
      '<div class="classify-options">';

    for (var i = 0; i < q.options.length; i++) {
      var opt = q.options[i];
      var sel = '';
      if (q.type === 'multi') {
        sel =
          currentVal &&
          Array.isArray(currentVal) &&
          currentVal.indexOf(opt.value) !== -1
            ? ' selected'
            : '';
      } else {
        sel = currentVal === opt.value ? ' selected' : '';
      }

      html +=
        '<button class="classify-option' +
        sel +
        '" data-value="' +
        opt.value +
        '" role="' +
        (q.type === 'multi' ? 'checkbox' : 'radio') +
        '" tabindex="0">' +
        '<div class="classify-checkbox"></div>' +
        '<span>' +
        opt.label +
        '</span>' +
        '</button>';
    }

    html += '</div>';
    html +=
      '<div class="classify-nav">' +
      '<button class="btn btn-ghost" id="classify-back">' + t('assessment.back_arrow') + '</button>' +
      '<button class="btn btn-primary" id="classify-next">' + t('assessment.next') + '</button>' +
      '</div>';

    $('classify-container').innerHTML = html;

    // Bind option clicks
    var options = $('classify-container').querySelectorAll(
      '.classify-option'
    );
    for (var j = 0; j < options.length; j++) {
      options[j].addEventListener('click', function () {
        var val = this.getAttribute('data-value');

        if (q.type === 'multi') {
          if (!Array.isArray(state.classification_answers[q.key])) {
            state.classification_answers[q.key] = [];
          }

          // "None" is exclusive
          if (val === 'none') {
            state.classification_answers[q.key] = ['none'];
          } else {
            var arr = state.classification_answers[q.key];
            var nIdx = arr.indexOf('none');
            if (nIdx !== -1) arr.splice(nIdx, 1);

            var vIdx = arr.indexOf(val);
            if (vIdx !== -1) {
              arr.splice(vIdx, 1);
            } else {
              arr.push(val);
            }
          }
        } else {
          state.classification_answers[q.key] = val;
        }
        saveState();
        renderClassifyStep();
      });
    }

    // Nav buttons
    $('classify-back').addEventListener('click', function () {
      if (classifyStep > 0) {
        classifyStep--;
        renderClassifyStep();
      } else {
        setPhase(3);
      }
    });

    $('classify-next').addEventListener('click', function () {
      // Validate answer exists
      var val = state.classification_answers[q.key];
      if (
        val === null ||
        val === undefined ||
        (Array.isArray(val) && val.length === 0)
      ) {
        return;
      }

      if (classifyStep < getClassifyQuestions().length - 1) {
        classifyStep++;
        renderClassifyStep();
      } else {
        // Classify and proceed
        state.risk_class = PrunexScoring.classifyRiskClass(
          state.classification_answers
        );
        saveState();
        prepareQuestions();
        setPhase(5);
        renderCurrentCategory();
      }
    });
  }

  // ── Phase 5: Scored Questions ───────────────────────────────────
  function prepareQuestions() {
    filteredQuestions = PrunexScoring.filterQuestions(
      questionsData.questions,
      state.selected_frameworks,
      state.risk_class
    );
    categories = PrunexScoring.getCategories(filteredQuestions);
    // Find last answered category to resume there
    if (Object.keys(state.answers).length > 0) {
      for (var i = categories.length - 1; i >= 0; i--) {
        var catQs = PrunexScoring.getQuestionsByCategory(
          filteredQuestions,
          categories[i]
        );
        var hasAnswer = catQs.some(function (q) {
          return state.answers[q.id] !== undefined;
        });
        if (hasAnswer) {
          currentCategoryIndex = i;
          break;
        }
      }
    } else {
      currentCategoryIndex = 0;
    }
  }

  function renderCurrentCategory() {
    var cat = categories[currentCategoryIndex];
    var catQuestions = PrunexScoring.getQuestionsByCategory(
      filteredQuestions,
      cat
    );
    var skippedSet = PrunexScoring.applySkipLogic(
      filteredQuestions,
      state.answers
    );

    // Update state.skipped
    state.skipped = Array.from(skippedSet);
    saveState();

    // Progress bar
    var totalAnswered = 0;
    var totalQuestions = filteredQuestions.length;
    filteredQuestions.forEach(function (q) {
      if (
        state.answers[q.id] !== undefined ||
        skippedSet.has(q.id)
      ) {
        totalAnswered++;
      }
    });
    var pct = totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0;
    $('progress-bar').style.width = pct + '%';
    $('progress-category').textContent = cat;
    $('progress-count').textContent =
      totalAnswered + ' ' + t('assessment.of') + ' ' + totalQuestions + ' ' + t('assessment.answered');

    var unanswered = totalQuestions - totalAnswered;
    var mins = PrunexScoring.estimateMinutesRemaining(unanswered);
    $('progress-time').textContent =
      mins > 0 ? '~' + mins + ' ' + t('assessment.min_remaining') : t('assessment.almost_done');

    // Render questions
    var html =
      '<div class="question-category-header">' +
      '<span class="eyebrow">' + t('assessment.category') + ' ' +
      (currentCategoryIndex + 1) +
      ' ' + t('assessment.of') + ' ' +
      categories.length +
      '</span>' +
      '<h2>' +
      cat +
      '</h2>' +
      '</div>';

    for (var i = 0; i < catQuestions.length; i++) {
      var q = catQuestions[i];
      var isSkipped = skippedSet.has(q.id);
      var score = state.answers[q.id];
      var blockClass = 'question-block';
      if (score !== undefined) blockClass += ' answered';
      if (isSkipped) blockClass += ' skipped';

      html +=
        '<div class="' +
        blockClass +
        '" data-qid="' +
        q.id +
        '">' +
        '<div class="question-text">' +
        q.question +
        '</div>' +
        '<div class="question-ref">' +
        '<strong>' + q.framework + '</strong>' +
        (q.regulatory_ref ? ' · ' + q.regulatory_ref : '') +
        '</div>';

      if (isSkipped) {
        html +=
          '<div class="question-skipped-msg">' + t('assessment.skipped_msg') + '</div>';
      } else {
        // Maturity options
        html += '<div class="maturity-options" role="radiogroup" aria-label="' + t('assessment.score_label') + '">';
        var labels = [t('assessment.maturity_0'), t('assessment.maturity_1'), t('assessment.maturity_2'), t('assessment.maturity_3'), t('assessment.maturity_4')];
        for (var s = 0; s <= 4; s++) {
          var matLabel =
            q.maturity_labels && q.maturity_labels[s]
              ? q.maturity_labels[s]
              : labels[s];
          var sel = score === s ? ' selected' : '';
          html +=
            '<button class="maturity-option' +
            sel +
            '" data-qid="' +
            q.id +
            '" data-score="' +
            s +
            '" role="radio" aria-checked="' +
            (score === s ? 'true' : 'false') +
            '" aria-label="Score ' +
            s +
            ': ' +
            labels[s] +
            '" tabindex="0" title="' +
            escapeAttr(matLabel) +
            '">' +
            '<span class="maturity-score">' +
            s +
            '</span>' +
            '<span class="maturity-label">' +
            labels[s] +
            '</span>' +
            '</button>';
        }
        html += '</div>';

        // Rationale
        if (q.rationale) {
          html +=
            '<div class="question-rationale">' +
            '<button class="rationale-toggle" aria-expanded="false">' +
            '<span class="rationale-arrow">▶</span> ' + t('assessment.why_matters') +
            '</button>' +
            '<div class="rationale-content">' +
            q.rationale +
            '</div>' +
            '</div>';
        }
      }

      html += '</div>';
    }

    $('questions-container').innerHTML = html;

    // Bind maturity clicks
    var matBtns = document.querySelectorAll('.maturity-option');
    for (var m = 0; m < matBtns.length; m++) {
      matBtns[m].addEventListener('click', handleMaturityClick);
    }

    // Bind rationale toggles
    var ratBtns = document.querySelectorAll('.rationale-toggle');
    for (var r = 0; r < ratBtns.length; r++) {
      ratBtns[r].addEventListener('click', function () {
        var content = this.nextElementSibling;
        var isOpen = content.classList.toggle('open');
        this.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        this.querySelector('.rationale-arrow').textContent = isOpen
          ? '▼'
          : '▶';
      });
    }

    // Update nav buttons
    $('btn-q-prev').style.visibility =
      currentCategoryIndex === 0 ? 'hidden' : 'visible';
    $('btn-q-next').textContent =
      currentCategoryIndex === categories.length - 1
        ? t('assessment.complete_assessment')
        : t('assessment.next');
  }

  function handleMaturityClick() {
    var qid = this.getAttribute('data-qid');
    var score = parseInt(this.getAttribute('data-score'), 10);

    // Toggle: clicking already selected deselects
    if (state.answers[qid] === score) {
      delete state.answers[qid];
    } else {
      state.answers[qid] = score;
    }
    saveState();
    renderCurrentCategory();
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function bindPhase5Nav() {
    $('btn-q-back').addEventListener('click', function () {
      if (currentCategoryIndex > 0) {
        currentCategoryIndex--;
        renderCurrentCategory();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Go back to framework selection or classification
        if (state.selected_frameworks.indexOf('EU AI Act') !== -1) {
          classifyStep = getClassifyQuestions().length - 1;
          setPhase(4);
          renderClassifyStep();
        } else {
          setPhase(3);
          renderFrameworkGrid();
        }
      }
    });

    $('btn-q-prev').addEventListener('click', function () {
      if (currentCategoryIndex > 0) {
        currentCategoryIndex--;
        renderCurrentCategory();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    $('btn-q-next').addEventListener('click', function () {
      // Validate all visible questions answered
      var cat = categories[currentCategoryIndex];
      var catQuestions = PrunexScoring.getQuestionsByCategory(
        filteredQuestions,
        cat
      );
      var skippedSet = new Set(state.skipped);
      var allAnswered = catQuestions.every(function (q) {
        return (
          skippedSet.has(q.id) || state.answers[q.id] !== undefined
        );
      });

      if (!allAnswered) {
        // Highlight unanswered
        catQuestions.forEach(function (q) {
          if (
            !skippedSet.has(q.id) &&
            state.answers[q.id] === undefined
          ) {
            var block = document.querySelector(
              '.question-block[data-qid="' + q.id + '"]'
            );
            if (block) {
              block.style.borderColor = '#dc2626';
              setTimeout(function () {
                block.style.borderColor = '';
              }, 2000);
            }
          }
        });
        // Scroll to first unanswered
        var first = catQuestions.find(function (q) {
          return (
            !skippedSet.has(q.id) && state.answers[q.id] === undefined
          );
        });
        if (first) {
          var el = document.querySelector(
            '.question-block[data-qid="' + first.id + '"]'
          );
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (currentCategoryIndex < categories.length - 1) {
        currentCategoryIndex++;
        renderCurrentCategory();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // All done → phase 6 lead capture
        setPhase(6);
      }
    });
  }

  // ── Phase 6: Lead Capture ───────────────────────────────────────
  function bindPhase6() {
    $('lead-form').addEventListener('submit', function (e) {
      e.preventDefault();

      var name = $('lead-name').value.trim();
      var email = $('lead-email').value.trim();
      var company = $('lead-company').value.trim();
      var role = $('lead-role').value.trim();
      var consent = $('lead-consent').checked;
      var marketing = $('lead-marketing').checked;

      if (!name || !email || !company || !role || !consent) {
        $('lead-error-msg').classList.add('show');
        return;
      }

      // Basic email validation
      if (email.indexOf('@') === -1 || email.indexOf('.') === -1) {
        $('lead-error-msg').textContent = t('assessment.lead_email_error');
        $('lead-error-msg').classList.add('show');
        return;
      }

      $('lead-error-msg').classList.remove('show');

      state.lead = {
        name: name,
        email: email,
        company: company,
        role: role,
      };
      state.completed_at = new Date().toISOString();
      saveState();

      // Submit lead
      var skippedSet = new Set(state.skipped);
      var results = PrunexScoring.calculateResults(
        filteredQuestions,
        state.answers,
        skippedSet,
        questionsData.frameworks,
        state.selected_frameworks
      );

      var payload = {
        name: name,
        email: email,
        company: company,
        role: role,
        consent: consent,
        marketing_opt_in: marketing,
        frameworks_assessed: state.selected_frameworks,
        overall_score: results.overall,
        risk_class: state.risk_class,
        timestamp: state.completed_at,
      };

      if (LEAD_ENDPOINT) {
        fetch(LEAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(function () {
          // silently fail
        });
      } else {
        console.log('Lead submission payload:', payload);
      }

      // Show results
      setPhase(7);
      renderResults(results);
    });
  }

  // ── Phase 7: Results Dashboard ──────────────────────────────────
  function renderResults(results) {
    var html = '';

    // Hero score
    var maturity = results.overallMaturity;
    html +=
      '<div class="results-hero">' +
      '<div class="results-score-ring">' +
      '<svg viewBox="0 0 180 180">' +
      '<circle class="score-bg" cx="90" cy="90" r="78" />' +
      '<circle class="score-fill" cx="90" cy="90" r="78" ' +
      'stroke="' +
      maturity.color +
      '" ' +
      'stroke-dasharray="' +
      (2 * Math.PI * 78) +
      '" ' +
      'stroke-dashoffset="' +
      (2 * Math.PI * 78) +
      '" ' +
      'id="score-ring-fill" />' +
      '</svg>' +
      '<div class="results-score-value" id="score-counter">0%</div>' +
      '</div>' +
      '<div class="results-maturity-badge" style="background: ' +
      maturity.color +
      ';">' +
      maturity.label +
      '</div>' +
      '<h2>' + t('assessment.results_title') + '</h2>' +
      '</div>';

    // EU AI Act section
    if (state.risk_class && state.selected_frameworks.indexOf('EU AI Act') !== -1) {
      var countdown = PrunexScoring.getEnforcementCountdown();
      var penalty = PrunexScoring.estimatePenaltyExposure(
        state.intake.size,
        state.risk_class
      );
      var riskColors = {
        prohibited: '#dc2626',
        high_risk: '#d97706',
        limited_risk: '#2563eb',
        minimal_risk: '#16a34a',
      };
      var riskLabels = {
        prohibited: t('assessment.results_risk_prohibited'),
        high_risk: t('assessment.results_risk_high'),
        limited_risk: t('assessment.results_risk_limited'),
        minimal_risk: t('assessment.results_risk_minimal'),
      };

      html +=
        '<div class="results-eu-section">' +
        '<h3 style="margin-bottom: 16px;">' + t('assessment.results_eu_title') + '</h3>' +
        '<div class="risk-badge" style="background: ' +
        (riskColors[state.risk_class] || '#737373') +
        ';">' +
        (riskLabels[state.risk_class] || state.risk_class) +
        '</div>' +
        '<div class="countdown-text">' +
        countdown.days +
        ' ' + t('assessment.results_days') + '</div>' +
        '<div class="countdown-label">' +
        countdown.label +
        '</div>' +
        '<div class="penalty-text">' + t('assessment.results_penalty') + ' ' +
        penalty +
        '</div>' +
        '</div>';
    }

    // Per-framework cards
    var fwNames = Object.keys(results.perFramework);
    for (var i = 0; i < fwNames.length; i++) {
      var name = fwNames[i];
      var fwResult = results.perFramework[name];

      html +=
        '<div class="fw-result-card" style="border-top-color: ' +
        fwResult.color +
        ';">' +
        '<div class="fw-result-header">' +
        '<h3>' +
        name +
        '</h3>' +
        '<div>' +
        '<span class="fw-result-score">' +
        fwResult.score +
        '%</span> ' +
        '<span class="fw-result-maturity" style="background: ' +
        fwResult.maturity.color +
        ';">' +
        fwResult.maturity.label +
        '</span>' +
        '</div>' +
        '</div>';

      // Radar chart
      var radarData = PrunexScoring.generateRadarData(
        fwResult.categoryScores,
        360,
        50
      );
      if (radarData.points) {
        html += '<div class="fw-radar-container">';
        html += '<svg viewBox="0 0 360 360" aria-label="Radar chart for ' + name + '">';

        // Grid polygons
        for (var g = 0; g < radarData.gridPolygons.length; g++) {
          html +=
            '<polygon points="' +
            radarData.gridPolygons[g] +
            '" fill="none" stroke="' +
            (g === radarData.gridPolygons.length - 1 ? '#d4d4d4' : '#e5e5e5') +
            '" stroke-width="1" />';
        }

        // Grid lines
        for (var l = 0; l < radarData.gridLines.length; l++) {
          var gl = radarData.gridLines[l];
          html +=
            '<line x1="' +
            gl.x1 +
            '" y1="' +
            gl.y1 +
            '" x2="' +
            gl.x2 +
            '" y2="' +
            gl.y2 +
            '" stroke="#e5e5e5" stroke-width="1" />';
        }

        // Data polygon
        html +=
          '<polygon points="' +
          radarData.points +
          '" fill="' +
          fwResult.color +
          '" fill-opacity="0.15" stroke="' +
          fwResult.color +
          '" stroke-width="2" />';

        // Data points
        var ptCoords = radarData.points.split(' ');
        for (var p = 0; p < ptCoords.length; p++) {
          var pt = ptCoords[p].split(',');
          html +=
            '<circle cx="' +
            pt[0] +
            '" cy="' +
            pt[1] +
            '" r="4" fill="' +
            fwResult.color +
            '" />';
        }

        // Labels
        for (var lb = 0; lb < radarData.labels.length; lb++) {
          var lbl = radarData.labels[lb];
          html +=
            '<text x="' +
            lbl.x +
            '" y="' +
            lbl.y +
            '" text-anchor="' +
            lbl.anchor +
            '" font-size="8" fill="#737373" font-family="Inter, sans-serif">' +
            lbl.text +
            '</text>';
        }

        html += '</svg>';
        html += '</div>';
      }

      // Priority gaps
      if (fwResult.gaps.length > 0) {
        html +=
          '<div class="fw-gaps">' +
          '<h4>' + t('assessment.results_gaps_title') + '</h4>';
        for (var gi = 0; gi < fwResult.gaps.length; gi++) {
          var gap = fwResult.gaps[gi];
          html +=
            '<div class="gap-item">' +
            '<div class="gap-text">' +
            gap.question +
            '</div>' +
            '<div class="gap-ref">' +
            (gap.regulatory_ref || '') +
            '</div>' +
            '</div>';
        }
        html += '</div>';
      }

      html += '</div>';
    }

    // CTA section
    html +=
      '<div class="results-cta">' +
      '<h3>' + t('assessment.results_whats_next') + '</h3>' +
      '<p style="color: var(--text-secondary); margin-bottom: 24px;">' + t('assessment.results_next_desc') + '</p>' +
      '<div class="results-cta-buttons">' +
      '<a href="contact.html" class="btn btn-primary btn-lg">' + t('assessment.results_book_call') + '</a>' +
      '<button class="btn btn-ghost" id="btn-download-report">' + t('assessment.download_report') + '</button>' +
      '<button class="btn btn-ghost" id="btn-share-results">' + t('assessment.copy_summary') + '</button>' +
      '</div>' +
      '</div>';

    // Disclaimer
    html +=
      '<p class="results-disclaimer">' + t('assessment.results_disclaimer') + '</p>';

    $('results-container').innerHTML = html;

    // Animate score ring and counter
    setTimeout(function () {
      animateScore(results.overall, maturity.color);
    }, 200);

    // Bind download / share
    var dlBtn = $('btn-download-report');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        window.print();
      });
    }

    var shareBtn = $('btn-share-results');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        var text =
          'Prunex Compliance Readiness Assessment\n' +
          'Overall Score: ' +
          results.overall +
          '% (' +
          maturity.label +
          ')\n' +
          'Frameworks: ' +
          state.selected_frameworks.join(', ') +
          '\n' +
          (state.risk_class
            ? 'EU AI Act Risk Class: ' + state.risk_class + '\n'
            : '') +
          'Assessed: ' +
          new Date(state.completed_at).toLocaleDateString();

        if (navigator.clipboard) {
          navigator.clipboard
            .writeText(text)
            .then(function () {
              shareBtn.textContent = t('assessment.copied');
              setTimeout(function () {
                shareBtn.textContent = t('assessment.copy_summary');
              }, 2000);
            })
            .catch(function () {
              prompt('Copy this summary:', text);
            });
        } else {
          prompt('Copy this summary:', text);
        }
      });
    }

    // Clear saved state (assessment complete)
    clearState();
  }

  function animateScore(target, color) {
    var ring = $('score-ring-fill');
    var counter = $('score-counter');
    if (!ring || !counter) return;

    var circumference = 2 * Math.PI * 78;
    var offset = circumference - (target / 100) * circumference;

    // Animate ring
    ring.style.strokeDashoffset = offset;

    // Animate counter
    var current = 0;
    var duration = 1500;
    var step = target / (duration / 16);

    function tick() {
      current += step;
      if (current >= target) {
        counter.textContent = target + '%';
        return;
      }
      counter.textContent = Math.round(current) + '%';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Boot ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
