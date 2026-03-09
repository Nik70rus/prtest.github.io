// ========== ОСНОВНОЕ ПРИЛОЖЕНИЕ ==========

(function() {
    // ========== СОСТОЯНИЕ ==========
    let currentScreen = 'start';
    let currentQuestionIndex = 0;
    let answers = {};
    let lastResult = null;
    let userInfo = {};
    const app = document.getElementById('app');

    // ========== РАСЧЁТЫ ==========
    function calculateScores(answersDict) {
        const scores = { 
            hysteroid: 0, epileptoid: 0, paranoid: 0, emotive: 0, 
            anxious: 0, hypertymic: 0, schizoid: 0 
        };
        
        for (let [qid, ans] of Object.entries(answersDict)) {
            if (ans === 'A') {
                const q = QUESTIONS.find(q => q.id == qid);
                if (q?.radical) scores[q.radical] += 1;
            }
        }
        
        return scores;
    }

    function calculatePercentages(scores) {
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        
        if (total === 0) {
            return Object.fromEntries(Object.keys(scores).map(k => [k, 0]));
        }
        
        let per = {};
        for (let k in scores) {
            per[k] = Math.round((scores[k] / total) * 100);
        }
        
        // Коррекция до 100%
        const sum = Object.values(per).reduce((a, b) => a + b, 0);
        if (sum !== 100) {
            let maxKey = Object.keys(per).reduce((a, b) => per[a] > per[b] ? a : b);
            per[maxKey] += (100 - sum);
        }
        
        return per;
    }

    function getLeadingRadical(perc) {
        return Object.keys(perc).reduce((a, b) => perc[a] > perc[b] ? a : b);
    }

    // ========== ИСТОРИЯ ==========
    function saveResultToHistory(percentages, leading, report, userData, resultType = 'test') {
        let history = JSON.parse(localStorage.getItem('psychoHistory') || '[]');
        
        history.unshift({ 
            id: Date.now(),
            date: new Date().toISOString(), 
            leading, 
            percentages, 
            report: report,
            user: userData,
            resultType: resultType // 'test' или 'manual'
        });
        
        if (history.length > 20) history = history.slice(0, 20);
        localStorage.setItem('psychoHistory', JSON.stringify(history));
    }

    function loadHistory() {
        return JSON.parse(localStorage.getItem('psychoHistory') || '[]');
    }

    function getHistoryItem(id) {
        const history = loadHistory();
        return history.find(h => h.id === id);
    }

    // ========== КОПИРОВАНИЕ ==========
    function getCopyText(percentages) {
        const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
        let lines = ['📊 Процентное соотношение радикалов:'];
        
        for (let [code, val] of sorted) {
            const [name, emoji] = RADICAL_NAMES[code] || [code, '•'];
            lines.push(`${emoji} ${name}: ${val}%`);
        }
        
        return lines.join('\n');
    }

    async function copyPercentages(percentages) {
        const text = getCopyText(percentages);
        
        try {
            await navigator.clipboard.writeText(text);
            showCopyNotification('✅ Скопировано');
        } catch {
            alert('Не удалось скопировать, вот текст:\n' + text);
        }
    }

    async function copyAllContent(percentages, userData, date = new Date()) {
        const text = profileGenerator.generateCopyAllText(percentages, userData, date);
        
        try {
            await navigator.clipboard.writeText(text);
            showCopyNotification('✅ Весь отчёт скопирован');
        } catch {
            alert('Не удалось скопировать, вот текст:\n\n' + text);
        }
    }

    function showCopyNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'copy-notification';
        notif.innerText = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }

    // ========== СОХРАНЕНИЕ В TXT ==========
    function downloadTXT(percentages, userData, date = new Date()) {
        const txt = profileGenerator.generateTXTReport(percentages, userData, date);
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `психорадикалы_${date.toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showCopyNotification('📥 Файл сохранён');
    }

    // ========== СОХРАНЕНИЕ В PDF ==========
    async function downloadPDF(percentages, userData, date = new Date()) {
        try {
            await profileGenerator.generatePDF(percentages, userData, date);
            showCopyNotification('📄 PDF сохранён');
        } catch (err) {
            alert('Ошибка создания PDF: ' + err.message);
        }
    }

    // ========== ВАЛИДАЦИЯ ФОРМЫ ==========
    function validateUserForm() {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const patronymic = document.getElementById('patronymic').value.trim();
        const dateOfBirth = document.getElementById('dateOfBirth').value;
        
        let isValid = true;
        let errors = {};
        
        // Имя обязательно
        if (!firstName) {
            errors.firstName = VALIDATION_MESSAGES.name_required;
            isValid = false;
        }
        
        // Дата рождения обязательна
        if (!dateOfBirth) {
            errors.dateOfBirth = VALIDATION_MESSAGES.dob_required;
            isValid = false;
        } else {
            // Проверка возраста
            const ageCheck = profileGenerator.isAgeValid(dateOfBirth);
            if (!ageCheck.isValid) {
                errors.ageWarning = ageCheck.message;
                isValid = false;
            }
        }
        
        // Отображение ошибок
        document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.form-group input').forEach(el => el.classList.remove('error'));
        document.getElementById('ageWarning')?.classList.remove('show');
        
        if (errors.firstName) {
            document.getElementById('firstNameError').classList.add('show');
            document.getElementById('firstName').classList.add('error');
        }
        if (errors.dateOfBirth) {
            document.getElementById('dateOfBirthError').classList.add('show');
            document.getElementById('dateOfBirth').classList.add('error');
        }
        if (errors.ageWarning) {
            document.getElementById('ageWarning').classList.add('show');
            document.getElementById('dateOfBirth').classList.add('error');
        }
        
        return {
            isValid,
            errors,
            userData: isValid ? {
                firstName,
                lastName,
                patronymic,
                dateOfBirth,
                age: profileGenerator.calculateAge(dateOfBirth)
            } : null
        };
    }

    // ========== ВАЛИДАЦИЯ РУЧНОГО ВВОДА ПРОЦЕНТОВ ==========
    function validateManualPercentages() {
        const percentages = {};
        let isValid = true;
        let errors = {};
        
        const radicalKeys = Object.keys(RADICAL_NAMES);
        let sum = 0;
        
        radicalKeys.forEach(key => {
            const input = document.getElementById(`percent_${key}`);
            const value = parseInt(input.value) || 0;
            
            if (input.value === '' || isNaN(value)) {
                errors[key] = VALIDATION_MESSAGES.percent_required;
                isValid = false;
            } else if (value < 0 || value > 100) {
                errors[key] = VALIDATION_MESSAGES.percent_invalid_value;
                isValid = false;
            }
            
            percentages[key] = value;
            sum += value;
        });
        
        // Проверка суммы
        if (sum !== 100) {
            errors.sum = VALIDATION_MESSAGES.percent_sum_invalid.replace('{sum}', sum);
            isValid = false;
        }
        
        // Отображение ошибок
        document.querySelectorAll('.percent-input-item input').forEach(el => el.classList.remove('error'));
        document.getElementById('percentSumDisplay')?.classList.remove('valid', 'invalid');
        
        radicalKeys.forEach(key => {
            if (errors[key]) {
                document.getElementById(`percent_${key}`).classList.add('error');
            }
        });
        
        const sumDisplay = document.getElementById('percentSumDisplay');
        if (sumDisplay) {
            if (sum === 100 && isValid) {
                sumDisplay.classList.add('valid');
                sumDisplay.innerHTML = `✅ Сумма: <span>${sum}%</span> — корректно`;
            } else {
                sumDisplay.classList.add('invalid');
                sumDisplay.innerHTML = `❌ Сумма: <span>${sum}%</span> — должна быть 100%`;
            }
        }
        
        return {
            isValid,
            errors,
            percentages: isValid ? percentages : null,
            sum: sum
        };
    }

    // ========== ОБНОВЛЕНИЕ СУММЫ ПРОЦЕНТОВ ==========
    function updatePercentSum() {
        const radicalKeys = Object.keys(RADICAL_NAMES);
        let sum = 0;
        
        radicalKeys.forEach(key => {
            const input = document.getElementById(`percent_${key}`);
            if (input) {
                const value = parseInt(input.value) || 0;
                sum += value;
            }
        });
        
        const sumDisplay = document.getElementById('percentSumDisplay');
        if (sumDisplay) {
            if (sum === 100) {
                sumDisplay.classList.add('valid');
                sumDisplay.classList.remove('invalid');
                sumDisplay.innerHTML = `✅ Сумма: <span>${sum}%</span> — корректно`;
            } else {
                sumDisplay.classList.add('invalid');
                sumDisplay.classList.remove('valid');
                sumDisplay.innerHTML = `❌ Сумма: <span>${sum}%</span> — должна быть 100%`;
            }
        }
    }

    // ========== РЕНДЕРИНГ ==========
    function render() {
        if (currentScreen === 'start') renderStart();
        else if (currentScreen === 'userForm') renderUserForm();
        else if (currentScreen === 'test') renderTest();
        else if (currentScreen === 'result') renderResult();
        else if (currentScreen === 'method') renderMethod();
        else if (currentScreen === 'history') renderHistory();
        else if (currentScreen === 'manualInput') renderManualInput();
    }

    function renderStart() {
        app.innerHTML = `
            <div class="start-screen">
                <h1><span>🧠</span> Тест на выявление психорадикалов</h1>
                <div class="sub">По авторской методике В.В. Пономаренко</div>
                <div style="background:#ffffffb0; border-radius:40px; padding:20px 14px;">
                    <p style="font-size:1.2rem; margin-bottom:20px;">7 типов личности:</p>
                    <div class="welcome-grid">
                        <div class="radical-badge" style="border-left-color:#d4af37;">🎭 Истероидный</div>
                        <div class="radical-badge" style="border-left-color:#b87333;">📊 Эпилептоидный</div>
                        <div class="radical-badge" style="border-left-color:#4b6b9c;">🎯 Паранойяльный</div>
                        <div class="radical-badge" style="border-left-color:#c0546b;">💖 Эмотивный</div>
                        <div class="radical-badge" style="border-left-color:#6d8f7a;">🛡 Тревожный</div>
                        <div class="radical-badge" style="border-left-color:#e68a56;">⚡ Гипертимный</div>
                        <div class="radical-badge" style="border-left-color:#7d6b91;">🧠 Шизоидный</div>
                    </div>
                    <button class="start-btn" id="startTestBtn">▶ ПРОЙТИ ТЕСТ</button>
                    <div class="flex-row">
                        <button class="nav-btn manual-btn" id="manualInputBtn">📝 Ручной ввод %</button>
                        <button class="nav-btn" id="historyBtn">📋 История</button>
                        <button class="nav-btn" id="aboutBtn">📚 О методе</button>
                    </div>
                </div>
                <footer>тест 35 · данные локально · персонализированные отчёты · 16+</footer>
            </div>
        `;
        
        document.getElementById('startTestBtn').addEventListener('click', () => {
            currentScreen = 'userForm'; 
            render();
        });
        
        document.getElementById('manualInputBtn').addEventListener('click', () => { 
            currentScreen = 'manualInput'; 
            render(); 
        });
        document.getElementById('historyBtn').addEventListener('click', () => { 
            currentScreen = 'history'; 
            render(); 
        });
        document.getElementById('aboutBtn').addEventListener('click', () => { 
            currentScreen = 'method'; 
            render(); 
        });
    }

    function renderUserForm() {
        app.innerHTML = `
            <div class="results-screen">
                <div class="user-form-container">
                    <h2>📝 Информация о пользователе</h2>
                    <p style="color:#64748b; margin:10px 0 20px;">Заполните данные для персонализации результатов</p>
                    
                    <div class="form-group">
                        <label>Фамилия</label>
                        <input type="text" id="lastName" placeholder="Иванов">
                    </div>
                    
                    <div class="form-group">
                        <label>Имя <span class="required">*</span></label>
                        <input type="text" id="firstName" placeholder="Иван">
                        <div class="form-error" id="firstNameError">${VALIDATION_MESSAGES.name_required}</div>
                    </div>
                    
                    <div class="form-group">
                        <label>Отчество</label>
                        <input type="text" id="patronymic" placeholder="Иванович">
                    </div>
                    
                    <div class="form-group">
                        <label>Дата рождения <span class="required">*</span></label>
                        <input type="date" id="dateOfBirth" max="${new Date().toISOString().split('T')[0]}">
                        <div class="form-error" id="dateOfBirthError">${VALIDATION_MESSAGES.dob_required}</div>
                    </div>
                    
                    <div class="age-warning" id="ageWarning">
                        <h4>⚠️ ${VALIDATION_MESSAGES.age_warning_title}</h4>
                        <p>${VALIDATION_MESSAGES.age_warning_text}</p>
                    </div>
                    
                    <div class="nav-buttons">
                        <button class="nav-btn" id="backToStart">🏠 Назад</button>
                        <button class="nav-btn action-btn" id="submitFormBtn">▶ Продолжить</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('backToStart')?.addEventListener('click', () => { 
            currentScreen = 'start'; 
            render(); 
        });
        
        document.getElementById('submitFormBtn')?.addEventListener('click', () => {
            const validation = validateUserForm();
            
            if (validation.isValid) {
                userInfo = validation.userData;
                currentScreen = 'test'; 
                currentQuestionIndex = 0; 
                answers = {}; 
                render();
            }
        });
    }

    function renderManualInput() {
        const radicalKeys = Object.keys(RADICAL_NAMES);
        
        let inputsHtml = '';
        radicalKeys.forEach(key => {
            const [name, emoji] = RADICAL_NAMES[key];
            inputsHtml += `
                <div class="percent-input-item">
                    <label>${emoji} ${name}</label>
                    <input type="number" id="percent_${key}" min="0" max="100" value="0" oninput="updatePercentSum()">
                </div>
            `;
        });
        
        app.innerHTML = `
            <div class="results-screen">
                <div class="manual-input-container">
                    <h2>📝 Ручной ввод процентов радикалов</h2>
                    <p style="color:#64748b; margin:10px 0 20px;">Введите процентное соотношение по каждому радикалу. Сумма должна быть равна 100%.</p>
                    
                    <div class="percent-inputs-grid">
                        ${inputsHtml}
                    </div>
                    
                    <div class="percent-sum-display" id="percentSumDisplay">
                        ❌ Сумма: <span>0%</span> — должна быть 100%
                    </div>
                    
                    <div class="nav-buttons">
                        <button class="nav-btn" id="backToStartManual">🏠 На главную</button>
                        <button class="nav-btn action-btn" id="submitManualBtn">▶ Получить отчёт</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('backToStartManual')?.addEventListener('click', () => { 
            currentScreen = 'start'; 
            render(); 
        });
        
        document.getElementById('submitManualBtn')?.addEventListener('click', () => {
            const validation = validateManualPercentages();
            
            if (validation.isValid) {
                // Генерация отчёта
                const { report, analysis } = profileGenerator.generateFullReport(validation.percentages);
                
                lastResult = { 
                    percentages: validation.percentages, 
                    leading: analysis.leading, 
                    profileReport: report,
                    user: userInfo,
                    resultType: 'manual'
                };
                
                saveResultToHistory(validation.percentages, analysis.leading, report, userInfo, 'manual');
                currentScreen = 'result';
                render();
            } else {
                if (validation.errors.sum) {
                    alert(validation.errors.sum);
                } else {
                    alert('Проверьте корректность введённых значений');
                }
            }
        });
    }

    function renderTest() {
        const q = QUESTIONS[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / QUESTIONS.length * 100).toFixed(1);
        const selected = answers[q.id] || '';
        
        let answersHtml = '';
        ['A', 'B'].forEach(opt => {
            const text = opt === 'A' ? q.A : q.B;
            const selClass = selected === opt ? 'selected' : '';
            answersHtml += `<button class="answer-btn ${selClass}" data-opt="${opt}" data-qid="${q.id}">${opt}. ${text}</button>`;
        });
        
        app.innerHTML = `
            <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span style="font-size:1.8rem;">📋</span>
                    <span style="font-weight:600; background:#eef3fa; padding:6px 18px; border-radius:60px;">${currentQuestionIndex + 1}/${QUESTIONS.length}</span>
                </div>
                <div class="progress-area"><div class="progress-fill" style="width:${progress}%;"></div></div>
                <div class="q-text">${q.text}</div>
                <div class="answers-grid">${answersHtml}</div>
                <div class="nav-buttons">
                    <button class="nav-btn" id="prevBtn" ${currentQuestionIndex === 0 ? 'disabled' : ''}>◀️ Пред.</button>
                    <button class="nav-btn reset-btn" id="resetTestBtn">🔄 Заново</button>
                    <button class="nav-btn" id="methodDuringTest">📚 О методе</button>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.answer-btn').forEach(b => b.addEventListener('click', e => {
            const opt = e.currentTarget.dataset.opt;
            const qid = parseInt(e.currentTarget.dataset.qid);
            answers[qid] = opt;
            
            if (currentQuestionIndex < QUESTIONS.length - 1) { 
                currentQuestionIndex++; 
                render(); 
            } else {
                finishTest();
            }
        }));
        
        document.getElementById('prevBtn')?.addEventListener('click', () => { 
            if (currentQuestionIndex > 0) currentQuestionIndex--; 
            render(); 
        });
        
        document.getElementById('resetTestBtn')?.addEventListener('click', () => { 
            if (confirm('Начать заново?')) {
                currentQuestionIndex = 0; 
                answers = {}; 
                render();
            }
        });
        
        document.getElementById('methodDuringTest')?.addEventListener('click', () => { 
            currentScreen = 'method'; 
            render(); 
        });
    }

    function finishTest() {
        if (Object.keys(answers).length < QUESTIONS.length) { 
            alert(`Ответьте на все вопросы`); 
            return; 
        }
        
        const raw = calculateScores(answers);
        const percentages = calculatePercentages(raw);
        const leading = getLeadingRadical(percentages);
        
        // Генерация персонализированного отчёта
        const { report } = profileGenerator.generateFullReport(percentages);
        
        lastResult = { 
            percentages, 
            leading, 
            raw,
            profileReport: report,
            user: userInfo,
            resultType: 'test'
        };
        
        saveResultToHistory(percentages, leading, report, userInfo, 'test');
        currentScreen = 'result';
        render();
    }

    function renderResult() {
        if (!lastResult) { 
            currentScreen = 'start'; 
            render(); 
            return; 
        }
        
        const { percentages, leading, profileReport, user, resultType } = lastResult;
        const [leadName, leadEmoji, leadSub] = RADICAL_NAMES[leading] || [leading, '', ''];
        const desc = RADICAL_DESCRIPTIONS[leading] || '';
        const strengths = STRENGTHS[leading] || [];
        const profs = PROFESSIONS[leading] || [];
        
        const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
        
        let rows = '';
        for (let [code, val] of sorted) {
            const [name, emoji] = RADICAL_NAMES[code] || [code, '•'];
            rows += `<div class="percent-row">
                <span style="min-width:140px;">${emoji} ${name}</span> 
                <span style="font-weight:700; width:40px;">${val}%</span> 
                <div class="bar"><div class="bar-fill" style="width:${val}%;"></div></div>
            </div>`;
        }
        
        let strengthItems = strengths.map((s, i) => `<li>${i + 1}. ${s}</li>`).join('');
        let profItems = profs.slice(0, 5).map((p, i) => `<li>${i + 1}. ${p}</li>`).join('');
        
        // Информация о пользователе
        let userInfoBlock = '';
        if (user) {
            const fullName = [user.lastName, user.firstName, user.patronymic].filter(Boolean).join(' ');
            userInfoBlock = `
                <div class="user-info-block">
                    <p><b>👤 Пользователь:</b> ${fullName || user.firstName}</p>
                    <p><b>🎂 Дата рождения:</b> ${new Date(user.dateOfBirth).toLocaleDateString('ru-RU')}</p>
                    <p><b>📊 Возраст:</b> ${user.age} лет</p>
                </div>
            `;
        }
        
        // Тип результата
        let resultTypeBadge = '';
        if (resultType === 'manual') {
            resultTypeBadge = `<div class="result-type-badge">📝 Ручной ввод процентов</div>`;
        }
        
        let history = loadHistory();
        let historyBlock = history.length > 1 ? 
            `<div class="history-area">📊 предыдущие: ${history.slice(0, 2).map(h => 
                new Date(h.date).toLocaleDateString() + ' ' + RADICAL_NAMES[h.leading]?.[0]
            ).join(' · ')}</div>` : '';
        
        // Генерация HTML отчёта
        const htmlReport = profileGenerator.generateHTMLReport(percentages);
        
        const resultDate = new Date();
        
        app.innerHTML = `
            <div class="results-screen">
                <div class="results-card">
                    <h2>🧠 ВАШ ПСИХОРАДИКАЛЬНЫЙ ПРОФИЛЬ
                        <button class="copy-btn" id="copyPercentagesBtn">📋 скопировать %</button>
                    </h2>
                    
                    ${resultTypeBadge}
                    ${userInfoBlock}
                    
                    <div style="font-size:1.2rem; margin-bottom:10px;">📊 Процентное соотношение:</div>
                    ${rows}
                    <div class="leading-block">
                        <div class="leading-title">🏆 Ведущий: ${leadEmoji} ${leadName} (${leadSub})</div>
                        <div style="font-size:1.1rem;">📝 ${desc}</div>
                    </div>
                    <div style="font-size:1.3rem; font-weight:700;">💪 Сильные стороны:</div>
                    <ul class="strength-list">${strengthItems}</ul>
                    <div style="font-size:1.3rem; font-weight:700;">💼 Подходящие профессии:</div>
                    <ul class="prof-list">${profItems}</ul>
                    
                    ${htmlReport}
                    
                    <div class="flex-row" style="margin:20px 0;">
                        <button class="nav-btn action-btn" id="downloadTxtBtn">📥 Сохранить TXT</button>
                        <button class="nav-btn pdf-btn" id="downloadPdfBtn">📄 Сохранить PDF</button>
                        <button class="nav-btn copy-all-btn" id="copyAllBtn">📋 Копировать всё</button>
                    </div>
                    
                    ${historyBlock}
                    <div class="nav-buttons">
                        <button class="nav-btn" id="againBtn">🔄 Ещё раз</button>
                        <button class="nav-btn manual-btn" id="manualFromResult">📝 Ручной ввод %</button>
                        <button class="nav-btn" id="historyFromResult">📋 История</button>
                        <button class="nav-btn" id="methodFromResult">📚 О методе</button>
                        <button class="nav-btn" id="mainMenuBtn">🏠 На главную</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('copyPercentagesBtn').addEventListener('click', () => copyPercentages(percentages));
        document.getElementById('downloadTxtBtn').addEventListener('click', () => downloadTXT(percentages, user, resultDate));
        document.getElementById('downloadPdfBtn').addEventListener('click', () => downloadPDF(percentages, user, resultDate));
        document.getElementById('copyAllBtn').addEventListener('click', () => copyAllContent(percentages, user, resultDate));
        document.getElementById('againBtn')?.addEventListener('click', () => { 
            currentScreen = 'userForm'; 
            userInfo = {};
            render(); 
        });
        document.getElementById('manualFromResult')?.addEventListener('click', () => { 
            currentScreen = 'manualInput'; 
            render(); 
        });
        document.getElementById('historyFromResult')?.addEventListener('click', () => { 
            currentScreen = 'history'; 
            render(); 
        });
        document.getElementById('methodFromResult')?.addEventListener('click', () => { 
            currentScreen = 'method'; 
            render(); 
        });
        document.getElementById('mainMenuBtn')?.addEventListener('click', () => { 
            currentScreen = 'start'; 
            render(); 
        });
    }

    function renderMethod() {
        app.innerHTML = `
            <div class="method-screen">
                <h1><span>📚</span> О методе радикалов</h1>
                <div class="method-container">
                    
                    <!-- Введение -->
                    <div style="background:#f8fafc; border-radius:28px; padding:20px; margin-bottom:20px; border:1px solid #e2e8f0;">
                        <h3 style="font-size:1.3rem; margin-bottom:12px; color:#1a2a4f;">🔍 Что это за методика?</h3>
                        <p style="font-size:1.05rem; line-height:1.6; color:#2d3748;">
                            Методика «7 психорадикалов» разработана <b>Виктором Викторовичем Пономаренко</b> — доктором психологических наук, профессором, специалистом в области экстремальной и прикладной психологии.
                        </p>
                        <p style="font-size:1.05rem; line-height:1.6; color:#2d3748; margin-top:10px;">
                            В основе лежит концепция <b>акцентуаций характера</b> — устойчивых особенностей личности, которые проявляются в типичных способах мышления, эмоционального реагирования и поведения. В отличие от клинических диагнозов, акцентуации есть у каждого человека и являются вариантом нормы.
                        </p>
                    </div>
    
                    <!-- Для кого -->
                    <div style="background:#f0f7ff; border-radius:28px; padding:20px; margin-bottom:20px; border:1px solid #bfdbfe;">
                        <h3 style="font-size:1.3rem; margin-bottom:12px; color:#1e40af;">👥 Для кого эта методика?</h3>
                        <ul style="font-size:1.05rem; line-height:1.7; color:#1e3a5f; padding-left:20px;">
                            <li><b>Для саморазвития:</b> лучше понять свои сильные стороны, зоны роста и внутренние конфликты.</li>
                            <li><b>Для карьеры:</b> выбрать подходящую профессию, стиль работы и коммуникации.</li>
                            <li><b>Для отношений:</b> осознать свои паттерны в общении и найти гармоничных партнёров.</li>
                            <li><b>Для руководителей:</b> эффективнее формировать команды и управлять людьми с учётом их психотипов.</li>
                            <li><b>Для педагогов и психологов:</b> использовать как инструмент первичной диагностики и сопровождения.</li>
                        </ul>
                    </div>
    
                    <!-- Зачем -->
                    <div style="background:#f0fdf4; border-radius:28px; padding:20px; margin-bottom:20px; border:1px solid #86efac;">
                        <h3 style="font-size:1.3rem; margin-bottom:12px; color:#166534;">💡 Зачем это нужно?</h3>
                        <p style="font-size:1.05rem; line-height:1.6; color:#14532d;">
                            Понимание своего психорадикального профиля помогает:
                        </p>
                        <ul style="font-size:1.05rem; line-height:1.7; color:#14532d; padding-left:20px; margin-top:10px;">
                            <li>✅ <b>Принимать более осознанные решения</b> — карьерные, личные, бытовые.</li>
                            <li>✅ <b>Снижать уровень внутренних конфликтов</b> — понимая, какие ваши черты «спорят» друг с другом.</li>
                            <li>✅ <b>Эффективнее выстраивать коммуникацию</b> — с коллегами, близкими, клиентами.</li>
                            <li>✅ <b>Предотвращать выгорание</b> — зная свои ресурсы и ограничения.</li>
                            <li>✅ <b>Развивать эмоциональный интеллект</b> — через осознание своих и чужих паттернов.</li>
                        </ul>
                    </div>
    
                    <!-- Важные принципы -->
                    <div style="background:#fef3c7; border-radius:28px; padding:20px; margin-bottom:20px; border:1px solid #fcd34d;">
                        <h3 style="font-size:1.3rem; margin-bottom:12px; color:#92400e;">⚠️ Важные принципы интерпретации</h3>
                        <ul style="font-size:1.05rem; line-height:1.7; color:#78350f; padding-left:20px;">
                            <li><b>Нет «плохих» или «хороших» радикалов.</b> Каждый тип имеет свои ресурсы и свои риски.</li>
                            <li><b>Чистые типы встречаются редко.</b> Личность — это всегда комбинация 2-4 радикалов в разной пропорции.</li>
                            <li><b>Профиль может меняться.</b> В течение жизни пропорции могут смещаться под влиянием опыта, окружения, осознанной работы над собой.</li>
                            <li><b>Это не диагноз и не приговор.</b> Методика описывает тенденции, а не жёсткие рамки. Вы всегда можете развивать недостающие качества.</li>
                            <li><b>Рекомендуемый возраст: 16+.</b> До этого возраста личность находится в стадии активного формирования, и результаты могут быть нестабильными.</li>
                        </ul>
                    </div>
    
                    <!-- Описание радикалов -->
                    <h3 style="font-size:1.4rem; margin:24px 0 16px; color:#1a2a4f; text-align:center;">🧭 7 психорадикалов: краткий справочник</h3>
                    
                    <div class="radical-method-block">
                        <h4>🎯 1. Паранойяльный (Целеустремлённый)</h4>
                        <p><b>Ключевая черта:</b> ориентация на масштабные цели, стратегическое мышление, напор.</p>
                        <p><b>Сильные стороны:</b> упорство, лидерские качества, видение перспективы, способность вести за собой.</p>
                        <p><b>Зоны риска:</b> может пренебрегать деталями, быть излишне настойчивым, игнорировать мнение других.</p>
                        <p><b>В общении:</b> речь уверенная, аргументированная, ориентирована на результат.</p>
                    </div>
                    
                    <div class="radical-method-block">
                        <h4>🎭 2. Истероидный (Демонстративный)</h4>
                        <p><b>Ключевая черта:</b> потребность во внимании, яркое самовыражение, артистизм.</p>
                        <p><b>Сильные стороны:</b> коммуникабельность, креативность, умение презентовать себя и идеи.</p>
                        <p><b>Зоны риска:</b> зависимость от оценок окружающих, склонность к драматизации, поверхностность в глубинных вопросах.</p>
                        <p><b>В общении:</b> эмоционален, выразителен, любит быть в центре внимания.</p>
                    </div>
                    
                    <div class="radical-method-block">
                        <h4>📊 3. Эпилептоидный (Организатор)</h4>
                        <p><b>Ключевая черта:</b> любовь к порядку, структуре, правилам, контроль.</p>
                        <p><b>Сильные стороны:</b> организованность, надёжность, дисциплина, внимание к деталям.</p>
                        <p><b>Зоны риска:</b> ригидность, вспыльчивость при нарушении правил, трудности с импровизацией.</p>
                        <p><b>В общении:</b> пунктуален, конкретен, ценит ясность и предсказуемость.</p>
                    </div>
                    
                    <div class="radical-method-block">
                        <h4>🧠 4. Шизоидный (Творческий)</h4>
                        <p><b>Ключевая черта:</b> погружённость в мир идей, нестандартное мышление, независимость.</p>
                        <p><b>Сильные стороны:</b> глубина анализа, креативность, способность к абстрактному мышлению.</p>
                        <p><b>Зоны риска:</b> отстранённость от бытовых вопросов, сложности в эмоциональном контакте.</p>
                        <p><b>В общении:</b> речь может быть абстрактной, эмоции сдержаны, ценит содержательные диалоги.</p>
                    </div>
                    
                    <div class="radical-method-block">
                        <h4>⚡ 5. Гипертимный (Активный)</h4>
                        <p><b>Ключевая черта:</b> высокая активность, жажда новых впечатлений, оптимизм.</p>
                        <p><b>Сильные стороны:</b> энергичность, адаптивность, лёгкость в установлении контактов.</p>
                        <p><b>Зоны риска:</b> поверхностность, трудности с завершением дел, склонность к риску.</p>
                        <p><b>В общении:</b> открыт, инициативен, любит разнообразие и динамику.</p>
                    </div>
                    
                    <div class="radical-method-block">
                        <h4>🛡 6. Тревожный (Чувствительный)</h4>
                        <p><b>Ключевая черта:</b> осторожность, предусмотрительность, чувствительность к рискам.</p>
                        <p><b>Сильные стороны:</b> аналитичность, исполнительность, внимание к деталям, надёжность.</p>
                        <p><b>Зоны риска:</b> излишняя мнительность, трудности с принятием решений, избегание конфликтов.</p>
                        <p><b>В общении:</b> тактичен, внимателен к настроению других, нуждается в поддержке.</p>
                    </div>
                    
                    <div class="radical-method-block">
                        <h4>💖 7. Эмотивный (Сопереживающий)</h4>
                        <p><b>Ключевая черта:</b> высокая эмпатия, стремление к гармонии, чувствительность.</p>
                        <p><b>Сильные стороны:</b> доброта, способность к поддержке, командная работа, создание комфортной атмосферы.</p>
                        <p><b>Зоны риска:</b> нерешительность, склонность принимать чужие проблемы на свой счёт, избегание жёстких решений.</p>
                        <p><b>В общении:</b> чуткий, мягкий, не выносит грубости и несправедливости.</p>
                    </div>
    
                    <!-- Ключевые выводы -->
                    <div class="key-points">
                        <p><b>🔑 Ключевые выводы:</b></p>
                        <ul style="margin-top:10px; padding-left:20px;">
                            <li>Радикал — это не ярлык, а <b>инструмент самопознания</b>.</li>
                            <li>Ваш профиль — это <b>уникальная комбинация</b>, а не набор изолированных черт.</li>
                            <li>Методика прикладная: она помогает <b>действовать осознаннее</b>, а не просто «знать о себе».</li>
                            <li>Для глубокой работы с профилем рекомендуется консультация с <b>сертифицированным специалистом</b> по методике В.В. Пономаренко.</li>
                        </ul>
                    </div>
    
                    <!-- Навигация -->
                    <div class="nav-buttons">
                        <button class="nav-btn" id="backFromMethod">🏠 На главную</button>
                        <button class="nav-btn action-btn" id="startTestFromMethod">▶ Пройти тест</button>
                    </div>
                    
                </div>
            </div>
        `;
        
        document.getElementById('backFromMethod')?.addEventListener('click', () => { 
            currentScreen = 'start'; 
            render(); 
        });
        document.getElementById('startTestFromMethod')?.addEventListener('click', () => { 
            currentScreen = 'userForm'; 
            userInfo = {};
            render(); 
        });
    }

    function renderHistory() {
        const history = loadHistory();
        
        let historyHtml = '';
        
        if (history.length === 0) {
            historyHtml = `<p style="text-align:center; padding:40px; color:#666;">📭 Нет сохранённых результатов</p>`;
        } else {
            historyHtml = history.map((item, index) => {
                const date = new Date(item.date).toLocaleString('ru-RU');
                const [leadName, leadEmoji] = RADICAL_NAMES[item.leading] || [item.leading, ''];
                const sorted = Object.entries(item.percentages).sort((a, b) => b[1] - a[1]);
                const top3 = sorted.slice(0, 3).map(([c, v]) => `${RADICAL_NAMES[c]?.[1]} ${v}%`).join(' · ');
                
                // Тип результата
                const typeBadge = item.resultType === 'manual' ? 
                    '<span class="history-item-type">📝 Ручной</span>' : '';
                
                // Информация о пользователе
                let userText = '';
                if (item.user) {
                    const fullName = [item.user.lastName, item.user.firstName, item.user.patronymic].filter(Boolean).join(' ');
                    userText = `<div class="history-item-user">👤 ${fullName || item.user.firstName} · ${item.user.age} лет</div>`;
                }
                
                return `
                    <div class="history-item">
                        <div class="history-item-header">
                            <span class="history-item-date">${index + 1}. ${date}</span>
                            <span class="history-item-leading">${leadEmoji} ${leadName}</span>
                        </div>
                        ${typeBadge}
                        ${userText}
                        <div style="font-size:0.9rem; color:#666; margin-bottom:8px;">${top3}</div>
                        <div class="history-item-actions">
                            <button class="history-action-btn" data-action="view" data-id="${item.id}">👁 Просмотр</button>
                            <button class="history-action-btn" data-action="download-txt" data-id="${item.id}">📥 TXT</button>
                            <button class="history-action-btn" data-action="download-pdf" data-id="${item.id}">📄 PDF</button>
                            <button class="history-action-btn" data-action="copy-all" data-id="${item.id}">📋 Копия</button>
                            <button class="history-action-btn" data-action="delete" data-id="${item.id}">🗑</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        app.innerHTML = `
            <div class="results-screen">
                <div class="results-card">
                    <h2>📋 История результатов</h2>
                    <div style="margin:20px 0;">${historyHtml}</div>
                    <div class="nav-buttons">
                        <button class="nav-btn" id="backToStart">🏠 На главную</button>
                        <button class="nav-btn" id="clearHistory">🗑 Очистить всё</button>
                    </div>
                </div>
            </div>
        `;
        
        // Обработчики действий истории
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = parseInt(e.currentTarget.dataset.id);
                handleHistoryAction(action, id);
            });
        });
        
        document.getElementById('backToStart')?.addEventListener('click', () => { 
            currentScreen = 'start'; 
            render(); 
        });
        
        document.getElementById('clearHistory')?.addEventListener('click', () => {
            if (confirm('Удалить всю историю?')) {
                localStorage.removeItem('psychoHistory');
                render();
            }
        });
    }

    function handleHistoryAction(action, id) {
        const item = getHistoryItem(id);
        if (!item) return;
        
        const date = new Date(item.date);
        
        switch (action) {
            case 'view':
                showHistoryItemModal(item);
                break;
            case 'download-txt':
                downloadTXT(item.percentages, item.user, date);
                break;
            case 'download-pdf':
                downloadPDF(item.percentages, item.user, date);
                break;
            case 'copy-all':
                copyAllContent(item.percentages, item.user, date);
                break;
            case 'delete':
                if (confirm('Удалить этот результат?')) {
                    let history = loadHistory();
                    history = history.filter(h => h.id !== id);
                    localStorage.setItem('psychoHistory', JSON.stringify(history));
                    render();
                }
                break;
        }
    }

    function showHistoryItemModal(item) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        const [leadName, leadEmoji] = RADICAL_NAMES[item.leading] || [item.leading, ''];
        const date = new Date(item.date).toLocaleString('ru-RU');
        
        // Тип результата
        const typeBadge = item.resultType === 'manual' ? 
            '<div class="result-type-badge">📝 Ручной ввод процентов</div>' : '';
        
        // Информация о пользователе
        let userInfoBlock = '';
        if (item.user) {
            const fullName = [item.user.lastName, item.user.firstName, item.user.patronymic].filter(Boolean).join(' ');
            userInfoBlock = `
                <div class="user-info-block" style="margin:16px 0;">
                    <p><b>👤 Пользователь:</b> ${fullName || item.user.firstName}</p>
                    <p><b>🎂 Дата рождения:</b> ${new Date(item.user.dateOfBirth).toLocaleDateString('ru-RU')}</p>
                    <p><b>📊 Возраст:</b> ${item.user.age} лет</p>
                </div>
            `;
        }
        
        let html = `<h2 style="margin-bottom:16px;">📊 Результат от ${date}</h2>`;
        html += typeBadge;
        html += userInfoBlock;
        html += `<div class="leading-block" style="margin:16px 0;">`;
        html += `<div class="leading-title">${leadEmoji} ${leadName} — ${item.percentages[item.leading]}%</div>`;
        html += `</div>`;
        
        // Проценты
        html += `<div style="font-size:1.1rem; font-weight:600; margin:16px 0;">📊 Процентное соотношение:</div>`;
        const sorted = Object.entries(item.percentages).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([code, val]) => {
            const [name, emoji] = RADICAL_NAMES[code] || [code, '•'];
            html += `<div class="percent-row">
                <span style="min-width:140px;">${emoji} ${name}</span>
                <span style="font-weight:700; width:40px;">${val}%</span>
                <div class="bar"><div class="bar-fill" style="width:${val}%;"></div></div>
            </div>`;
        });
        
        // Полный отчёт
        html += profileGenerator.generateHTMLReport(item.percentages);
        
        // Кнопки
        const resultDate = new Date(item.date);
        html += `<div class="flex-row" style="margin:20px 0;">
            <button class="nav-btn action-btn" id="modalDownloadTxtBtn">📥 Сохранить TXT</button>
            <button class="nav-btn pdf-btn" id="modalDownloadPdfBtn">📄 Сохранить PDF</button>
            <button class="nav-btn copy-all-btn" id="modalCopyAllBtn">📋 Копировать всё</button>
        </div>`;
        
        html += `<button class="modal-close">Закрыть</button>`;
        
        content.innerHTML = html;
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        // Обработчики
        content.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
        content.querySelector('#modalDownloadTxtBtn').addEventListener('click', () => {
            downloadTXT(item.percentages, item.user, resultDate);
        });
        content.querySelector('#modalDownloadPdfBtn').addEventListener('click', () => {
            downloadPDF(item.percentages, item.user, resultDate);
        });
        content.querySelector('#modalCopyAllBtn').addEventListener('click', () => {
            copyAllContent(item.percentages, item.user, resultDate);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // ========== ЗАПУСК ==========
    render();
})();