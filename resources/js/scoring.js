/* ===================================================================
   PRUNEX — Scoring Engine
   Pure functions for compliance assessment scoring.
   No DOM, no state, no side effects — fully testable.
   =================================================================== */

const PrunexScoring = (function () {
  'use strict';

  /**
   * Calculate overall score for a set of questions.
   * @param {Array} questions - Array of question objects
   * @param {Object} answers - Map of questionId → score (0–4)
   * @param {Set} skipped - Set of skipped question IDs
   * @returns {number} Score as percentage (0–100), or 0 if no answered questions
   */
  function calculateFrameworkScore(questions, answers, skipped) {
    const answered = questions.filter(
      (q) => answers[q.id] !== undefined && !skipped.has(q.id)
    );
    if (answered.length === 0) return 0;

    const score = answered.reduce((sum, q) => sum + (answers[q.id] || 0), 0);
    const maxPossible = answered.length * 4;
    return Math.round((score / maxPossible) * 100);
  }

  /**
   * Calculate weighted score for a set of questions.
   * @param {Array} questions - Array of question objects
   * @param {Object} answers - Map of questionId → score (0–4)
   * @param {Set} skipped - Set of skipped question IDs
   * @returns {number} Weighted score as percentage (0–100)
   */
  function calculateWeightedScore(questions, answers, skipped) {
    const answered = questions.filter(
      (q) => answers[q.id] !== undefined && !skipped.has(q.id)
    );
    if (answered.length === 0) return 0;

    const weightedScore = answered.reduce(
      (sum, q) => sum + (answers[q.id] || 0) * (q.weight || 1),
      0
    );
    const maxWeighted = answered.reduce(
      (sum, q) => sum + 4 * (q.weight || 1),
      0
    );
    return Math.round((weightedScore / maxWeighted) * 100);
  }

  /**
   * Calculate scores grouped by category.
   * @param {Array} questions - Array of question objects
   * @param {Object} answers - Map of questionId → score (0–4)
   * @param {Set} skipped - Set of skipped question IDs
   * @returns {Object} Map of category → score percentage
   */
  function calculateCategoryScores(questions, answers, skipped) {
    const byCategory = {};

    questions.forEach((q) => {
      if (!byCategory[q.category]) {
        byCategory[q.category] = [];
      }
      byCategory[q.category].push(q);
    });

    const result = {};
    for (const [category, categoryQuestions] of Object.entries(byCategory)) {
      result[category] = calculateFrameworkScore(
        categoryQuestions,
        answers,
        skipped
      );
    }
    return result;
  }

  /**
   * Get maturity level from a percentage score.
   * @param {number} score - Score percentage (0–100)
   * @returns {{ label: string, color: string, level: number }}
   */
  function getMaturityLevel(score) {
    if (score <= 20)
      return { label: 'Not Started', color: '#dc2626', level: 0 };
    if (score <= 40)
      return { label: 'Foundational', color: '#ea580c', level: 1 };
    if (score <= 60)
      return { label: 'Developing', color: '#d97706', level: 2 };
    if (score <= 80)
      return { label: 'Established', color: '#2563eb', level: 3 };
    return { label: 'Optimized', color: '#16a34a', level: 4 };
  }

  /**
   * Get top priority gaps — questions scoring 0 or 1, sorted by weight.
   * @param {Array} questions - Array of question objects
   * @param {Object} answers - Map of questionId → score (0–4)
   * @param {Set} skipped - Set of skipped question IDs
   * @param {number} [limit=3] - Max number of gaps to return
   * @returns {Array} Array of { id, question, regulatory_ref, weight, score, category }
   */
  function getPriorityGaps(questions, answers, skipped, limit) {
    if (limit === undefined) limit = 3;

    return questions
      .filter((q) => {
        if (skipped.has(q.id)) return false;
        if (answers[q.id] === undefined) return false;
        if (answers[q.id] > 1) return false;
        return q.priority === 'Critical' || q.priority === 'High';
      })
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, limit)
      .map((q) => ({
        id: q.id,
        question: q.question,
        regulatory_ref: q.regulatory_ref,
        weight: q.weight,
        score: answers[q.id],
        category: q.category,
      }));
  }

  /**
   * Apply skip logic based on parent-child dependencies.
   * If a parent question scores 0, all its dependents are skipped.
   * @param {Array} questions - Array of question objects
   * @param {Object} answers - Map of questionId → score (0–4)
   * @returns {Set} Set of skipped question IDs
   */
  function applySkipLogic(questions, answers) {
    const skipped = new Set();

    questions.forEach((q) => {
      if (
        q.dependents &&
        q.dependents.length > 0 &&
        answers[q.id] === 0
      ) {
        q.dependents.forEach((depId) => skipped.add(depId));
      }
    });

    return skipped;
  }

  /**
   * Classify EU AI Act risk class based on classification gate answers.
   * @param {Object} classAnswers - { q1, q2, q3, q4, q5 }
   *   q1: string (a/b/c/d)
   *   q2: Array of selected strings
   *   q3: string (a/b/c/d)
   *   q4: string (a/b/c)
   *   q5: string (a/b/c/d)
   * @returns {string} "prohibited" | "high_risk" | "limited_risk" | "minimal_risk"
   */
  function classifyRiskClass(classAnswers) {
    if (!classAnswers) return 'minimal_risk';

    // Check for prohibited practices
    if (
      classAnswers.q3 === 'a' ||
      classAnswers.q3 === 'b' ||
      classAnswers.q3 === 'c'
    ) {
      return 'prohibited';
    }

    // Check for high-risk areas
    if (
      classAnswers.q2 &&
      Array.isArray(classAnswers.q2) &&
      classAnswers.q2.length > 0 &&
      !classAnswers.q2.includes('none')
    ) {
      return 'high_risk';
    }

    // Check for GPAI usage → limited risk
    if (classAnswers.q4 === 'a' || classAnswers.q4 === 'b') {
      return 'limited_risk';
    }

    return 'minimal_risk';
  }

  /**
   * Filter questions based on selected frameworks and EU AI Act risk class.
   * @param {Array} allQuestions - All questions from questions.json
   * @param {Array} selectedFrameworks - Array of framework names
   * @param {string|null} riskClass - EU AI Act risk class or null
   * @returns {Array} Filtered array of applicable questions
   */
  function filterQuestions(allQuestions, selectedFrameworks, riskClass) {
    return allQuestions.filter((q) => {
      // Must be in a selected framework
      if (!selectedFrameworks.includes(q.framework)) return false;

      // For EU AI Act, apply risk class filter
      if (q.framework === 'EU AI Act' && q.risk_class_filter) {
        if (!riskClass) return false;
        if (!q.risk_class_filter.includes(riskClass)) return false;
      }

      return true;
    });
  }

  /**
   * Get unique categories from a list of questions in display order.
   * @param {Array} questions - Array of question objects
   * @returns {Array} Array of category name strings (preserving order from data)
   */
  function getCategories(questions) {
    const seen = new Set();
    const categories = [];
    questions.forEach((q) => {
      if (!seen.has(q.category)) {
        seen.add(q.category);
        categories.push(q.category);
      }
    });
    return categories;
  }

  /**
   * Get questions for a specific category.
   * @param {Array} questions - Array of question objects
   * @param {string} category - Category name
   * @returns {Array} Questions in that category
   */
  function getQuestionsByCategory(questions, category) {
    return questions.filter((q) => q.category === category);
  }

  /**
   * Calculate estimated time remaining.
   * @param {number} unansweredCount - Number of unanswered questions
   * @param {number} [secondsPerQuestion=25] - Seconds per question estimate
   * @returns {number} Minutes remaining (rounded up)
   */
  function estimateMinutesRemaining(unansweredCount, secondsPerQuestion) {
    if (secondsPerQuestion === undefined) secondsPerQuestion = 25;
    return Math.ceil((unansweredCount * secondsPerQuestion) / 60);
  }

  /**
   * Calculate overall score across multiple frameworks.
   * @param {Array} allQuestions - All filtered questions
   * @param {Object} answers - Map of questionId → score
   * @param {Set} skipped - Set of skipped IDs
   * @param {Array} frameworks - Array of framework metadata objects
   * @param {Array} selectedFrameworks - Array of selected framework names
   * @returns {Object} { overall, perFramework: { name: { score, maturity, categoryScores, gaps } } }
   */
  function calculateResults(
    allQuestions,
    answers,
    skipped,
    frameworks,
    selectedFrameworks
  ) {
    const perFramework = {};
    let totalWeightedScore = 0;
    let totalMaxWeighted = 0;

    selectedFrameworks.forEach((fwName) => {
      const fw = frameworks.find((f) => f.name === fwName);
      const fwQuestions = allQuestions.filter((q) => q.framework === fwName);
      const score = calculateFrameworkScore(fwQuestions, answers, skipped);
      const categoryScores = calculateCategoryScores(
        fwQuestions,
        answers,
        skipped
      );
      const gaps = getPriorityGaps(fwQuestions, answers, skipped, 3);
      const maturity = getMaturityLevel(score);

      // Accumulate for overall
      const answered = fwQuestions.filter(
        (q) => answers[q.id] !== undefined && !skipped.has(q.id)
      );
      totalWeightedScore += answered.reduce(
        (s, q) => s + (answers[q.id] || 0),
        0
      );
      totalMaxWeighted += answered.length * 4;

      perFramework[fwName] = {
        score,
        maturity,
        categoryScores,
        gaps,
        color: fw ? fw.color : '#1a3a2a',
        questionCount: fwQuestions.length,
        answeredCount: answered.length,
      };
    });

    const overall =
      totalMaxWeighted > 0
        ? Math.round((totalWeightedScore / totalMaxWeighted) * 100)
        : 0;

    return {
      overall,
      overallMaturity: getMaturityLevel(overall),
      perFramework,
    };
  }

  /**
   * Generate SVG radar chart data points.
   * @param {Object} categoryScores - Map of category → score (0–100)
   * @param {number} size - SVG viewBox size
   * @param {number} [padding=40] - Padding from edges
   * @returns {{ points: string, labels: Array, gridLines: Array }}
   */
  function generateRadarData(categoryScores, size, padding) {
    if (padding === undefined) padding = 40;

    const categories = Object.keys(categoryScores);
    const n = categories.length;
    if (n < 3) return { points: '', labels: [], gridLines: [] };

    const center = size / 2;
    const radius = (size - padding * 2) / 2;
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2; // Start from top

    // Data points
    const dataPoints = categories.map((cat, i) => {
      const angle = startAngle + i * angleStep;
      const value = (categoryScores[cat] || 0) / 100;
      const r = value * radius;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      };
    });

    const points = dataPoints.map((p) => p.x + ',' + p.y).join(' ');

    // Labels with positions
    const labels = categories.map((cat, i) => {
      const angle = startAngle + i * angleStep;
      const labelR = radius + 20;
      return {
        text: cat.length > 20 ? cat.substring(0, 18) + '…' : cat,
        fullText: cat,
        x: center + labelR * Math.cos(angle),
        y: center + labelR * Math.sin(angle),
        score: categoryScores[cat] || 0,
        anchor:
          Math.abs(Math.cos(angle)) < 0.1
            ? 'middle'
            : Math.cos(angle) > 0
              ? 'start'
              : 'end',
      };
    });

    // Grid lines (axes from center to edge)
    const gridLines = categories.map(function (cat, i) {
      var angle = startAngle + i * angleStep;
      return {
        x1: center,
        y1: center,
        x2: center + radius * Math.cos(angle),
        y2: center + radius * Math.sin(angle),
      };
    });

    // Grid polygons at 25%, 50%, 75%, 100%
    var gridPolygons = [0.25, 0.5, 0.75, 1].map(function (level) {
      return categories
        .map(function (cat, i) {
          var angle = startAngle + i * angleStep;
          var r = level * radius;
          return center + r * Math.cos(angle) + ',' + (center + r * Math.sin(angle));
        })
        .join(' ');
    });

    return { points: points, labels: labels, gridLines: gridLines, gridPolygons: gridPolygons, center: center, radius: radius };
  }

  /**
   * Get EU AI Act enforcement countdown.
   * @returns {{ days: number, label: string }}
   */
  function getEnforcementCountdown() {
    var target = new Date('2026-08-02T00:00:00Z');
    var now = new Date();
    var diff = target.getTime() - now.getTime();
    var days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    var label =
      days === 0
        ? 'Enforcement deadline has passed'
        : days + ' days until full enforcement';
    return { days: days, label: label };
  }

  /**
   * Estimate penalty exposure based on company size.
   * @param {string} companySize - From intake: "1-50", "51-200", "201-1000", "1000+"
   * @param {string} riskClass - EU AI Act risk class
   * @returns {string} Estimated penalty range text
   */
  function estimatePenaltyExposure(companySize, riskClass) {
    if (riskClass === 'prohibited') {
      return 'Up to €35M or 7% of global turnover (highest tier)';
    }
    if (riskClass === 'high_risk') {
      switch (companySize) {
        case '1-50':
          return 'Up to €7.5M or 1.5% of global turnover';
        case '51-200':
          return 'Up to €15M or 3% of global turnover';
        case '201-1000':
          return 'Up to €15M or 3% of global turnover';
        case '1000+':
          return 'Up to €15M or 3% of global turnover';
        default:
          return 'Up to €15M or 3% of global turnover';
      }
    }
    return 'Up to €7.5M or 1% of global turnover';
  }

  /**
   * Map intake industry value to framework recommended_for matching values.
   * @param {string} industry - Intake industry selection
   * @returns {string} Framework recommended_for value
   */
  function mapIndustryToRecommended(industry) {
    var mapping = {
      'Healthcare / MedTech': 'Healthcare/MedTech',
      'Financial Services': 'Financial Services',
      'Technology / SaaS': 'Technology/SaaS',
      'Manufacturing / Industry': 'Manufacturing/Industry',
      'Legal / Insurance': 'Legal/Insurance',
      Other: null,
    };
    return mapping[industry] || null;
  }

  // Public API
  return {
    calculateFrameworkScore: calculateFrameworkScore,
    calculateWeightedScore: calculateWeightedScore,
    calculateCategoryScores: calculateCategoryScores,
    getMaturityLevel: getMaturityLevel,
    getPriorityGaps: getPriorityGaps,
    applySkipLogic: applySkipLogic,
    classifyRiskClass: classifyRiskClass,
    filterQuestions: filterQuestions,
    getCategories: getCategories,
    getQuestionsByCategory: getQuestionsByCategory,
    estimateMinutesRemaining: estimateMinutesRemaining,
    calculateResults: calculateResults,
    generateRadarData: generateRadarData,
    getEnforcementCountdown: getEnforcementCountdown,
    estimatePenaltyExposure: estimatePenaltyExposure,
    mapIndustryToRecommended: mapIndustryToRecommended,
  };
})();
