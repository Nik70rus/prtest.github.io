// ========== ОСНОВНОЕ ПРИЛОЖЕНИЕ ==========

// ========== НАСТРОЙКИ ДЛЯ СОХРАНЕНИЯ ДАННЫХ ==========
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwepVCOJwOAY82px2VkzCcHeRn6cgmmQUWjJyyO3ZIf5djEo4OOllzixyGL1OwGWPVc/exec';
const ENABLE_REMOTE_SAVE = true; // Включить сохранение в Google Таблицу

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

    // ========== ОТПРАВКА ДАННЫХ В GOOGLE ТАБЛИЦУ ==========
    async function saveToGoogleSheet(userData, percentages, leading, resultType, profileType) {
        if (!ENABLE_REMOTE_SAVE || !GOOGLE_SCRIPT_URL) {
            console.log('Сохранение в Google Таблицу отключено');
            return { success: false, reason: 'not_configured' };
        }

        const payload = {
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            patronymic: userData?.patronymic || '',
            dateOfBirth: userData?.dateOfBirth || '',
            age: userData?.age || 0,
            leading: leading,
            leadingPercent: percentages[leading] || 0,
            percentages: percentages,
            resultType: resultType,
            profileType: profileType
        };

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                mode: 'no-cors' // Важно для обхода CORS
            });

            // При mode: 'no-cors' ответ будет opaque, но данные отправятся
            console.log('✅ Данные отправлены в Google Таблицу');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            return { success: false, error: error.message };
        }
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

    // ========== ВАЛИДАЦИЯ ФОРМЫ РУЧНОГО ВВОДА (С ФИО) ==========
    function validateManualInputForm() {
        // Сначала валидируем личные данные
        const firstName = document.getElementById('manual_firstName').value.trim();
        const lastName = document.getElementById('manual_lastName').value.trim();
        const patronymic = document.getElementById('manual_patronymic').value.trim();
        const dateOfBirth = document.getElementById('manual_dateOfBirth').value;
        
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
        
        // Отображение ошибок в форме личных данных
        document.querySelectorAll('.manual-form-error').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.manual-form-group input').forEach(el => el.classList.remove('error'));
        document.getElementById('manual_ageWarning')?.classList.remove('show');
        
        if (errors.firstName) {
            document.getElementById('manual_firstNameError').classList.add('show');
            document.getElementById('manual_firstName').classList.add('error');
        }
        if (errors.dateOfBirth) {
            document.getElementById('manual_dateOfBirthError').classList.add('show');
            document.getElementById('manual_dateOfBirth').classList.add('error');
        }
        if (errors.ageWarning) {
            document.getElementById('manual_ageWarning').classList.add('show');
            document.getElementById('manual_dateOfBirth').classList.add('error');
        }
        
        if (!isValid) {
            return { isValid: false, errors, userData: null, percentages: null };
        }
        
        // Теперь валидируем проценты
        const percentValidation = validateManualPercentages();
        
        return {
            isValid: percentValidation.isValid,
            errors: { ...errors, ...percentValidation.errors },
            userData: {
                firstName,
                lastName,
                patronymic,
                dateOfBirth,
                age: profileGenerator.calculateAge(dateOfBirth)
            },
            percentages: percentValidation.percentages,
            sum: percentValidation.sum
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
                <h1><span>🧠</span> Психорадикалы</h1>
                <div class="sub">В. Пономаренко · 35 вопросов</div>
                <div style="background:#ffffffb0; border-radius:40px; padding:20px 14px;">
                    <p style="font-size:1.2rem; margin-bottom:20px;">7 типов личности:</p>
                    <div class="welcome-grid">
                        <div class="radical-badge" style="border-left-color:#d4af37;" data-radical="hysteroid">🎭 Истероидный</div>
                        <div class="radical-badge" style="border-left-color:#b87333;" data-radical="epileptoid">📊 Эпилептоидный</div>
                        <div class="radical-badge" style="border-left-color:#4b6b9c;" data-radical="paranoid">🎯 Паранойяльный</div>
                        <div class="radical-badge" style="border-left-color:#c0546b;" data-radical="emotive">💖 Эмотивный</div>
                        <div class="radical-badge" style="border-left-color:#6d8f7a;" data-radical="anxious">🛡 Тревожный</div>
                        <div class="radical-badge" style="border-left-color:#e68a56;" data-radical="hypertymic">⚡ Гипертимный</div>
                        <div class="radical-badge" style="border-left-color:#7d6b91;" data-radical="schizoid">🧠 Шизоидный</div>
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
        
        // Обработчики кликов на радикалы
        document.querySelectorAll('.radical-badge').forEach(badge => {
            badge.addEventListener('click', () => {
                const radical = badge.dataset.radical;
                currentScreen = 'method';
                render();
                // Прокрутка к нужному радикалу после рендера
                setTimeout(() => {
                    const element = document.getElementById(`radical-${radical}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Подсветка элемента
                        element.style.background = '#fef3c7';
                        element.style.borderColor = '#f59e0b';
                        setTimeout(() => {
                            element.style.background = '#f7faff';
                            element.style.borderColor = '#cbd6e8';
                        }, 2000);
                    }
                }, 100);
            });
        });
        
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
                    
                    <!-- Форма личных данных -->
                    <div style="background:#f0f7ff; border-radius:20px; padding:16px; margin:16px 0; border:1px solid #bfdbfe;">
                        <h3 style="font-size:1.1rem; margin-bottom:12px; color:#1e40af;">👤 Данные пользователя</h3>
                        
                        <div class="manual-form-group form-group">
                            <label>Фамилия</label>
                            <input type="text" id="manual_lastName" placeholder="Иванов">
                        </div>
                        
                        <div class="manual-form-group form-group">
                            <label>Имя <span class="required">*</span></label>
                            <input type="text" id="manual_firstName" placeholder="Иван">
                            <div class="form-error manual-form-error" id="manual_firstNameError">${VALIDATION_MESSAGES.name_required}</div>
                        </div>
                        
                        <div class="manual-form-group form-group">
                            <label>Отчество</label>
                            <input type="text" id="manual_patronymic" placeholder="Иванович">
                        </div>
                        
                        <div class="manual-form-group form-group">
                            <label>Дата рождения <span class="required">*</span></label>
                            <input type="date" id="manual_dateOfBirth" max="${new Date().toISOString().split('T')[0]}">
                            <div class="form-error manual-form-error" id="manual_dateOfBirthError">${VALIDATION_MESSAGES.dob_required}</div>
                        </div>
                        
                        <div class="age-warning" id="manual_ageWarning">
                            <h4>⚠️ ${VALIDATION_MESSAGES.age_warning_title}</h4>
                            <p>${VALIDATION_MESSAGES.age_warning_text}</p>
                        </div>
                    </div>
                    <!-- Конец формы личных данных -->
                    
                    <h3 style="font-size:1.1rem; margin:20px 0 12px; color:#1e40af;">📊 Процентное соотношение радикалов</h3>
                    
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
        
        document.getElementById('submitManualBtn')?.addEventListener('click', async () => {
            const validation = validateManualInputForm();
            
            if (validation.isValid) {
                // Генерация отчёта
                const { report, analysis } = profileGenerator.generateFullReport(validation.percentages);
                
                lastResult = { 
                    percentages: validation.percentages, 
                    leading: analysis.leading, 
                    profileReport: report,
                    user: validation.userData,
                    resultType: 'manual',
                    profileType: analysis.profileType
                };
                
                // Сохранение в локальную историю
                saveResultToHistory(validation.percentages, analysis.leading, report, validation.userData, 'manual');
                
                // Отправка в Google Таблицу
                if (ENABLE_REMOTE_SAVE) {
                    showCopyNotification('⏳ Отправка данных...');
                    await saveToGoogleSheet(validation.userData, validation.percentages, analysis.leading, 'manual', analysis.profileType);
                }
                
                currentScreen = 'result';
                render();
            } else {
                if (validation.errors.sum) {
                    alert(validation.errors.sum);
                } else if (validation.errors.firstName || validation.errors.dateOfBirth || validation.errors.ageWarning) {
                    alert('Заполните корректно личные данные (имя и дата рождения обязательны, возраст 16+)');
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

    async function finishTest() {
        if (Object.keys(answers).length < QUESTIONS.length) { 
            alert(`Ответьте на все вопросы`); 
            return; 
        }
        
        const raw = calculateScores(answers);
        const percentages = calculatePercentages(raw);
        const leading = getLeadingRadical(percentages);
        
        // Генерация персонализированного отчёта
        const { report, analysis } = profileGenerator.generateFullReport(percentages);
        
        lastResult = { 
            percentages, 
            leading, 
            raw,
            profileReport: report,
            user: userInfo,
            resultType: 'test',
            profileType: analysis.profileType
        };
        
        // Сохранение в локальную историю
        saveResultToHistory(percentages, leading, report, userInfo, 'test');
        
        // Отправка в Google Таблицу
        if (ENABLE_REMOTE_SAVE) {
            showCopyNotification('⏳ Отправка данных...');
            await saveToGoogleSheet(userInfo, percentages, leading, 'test', analysis.profileType);
        }
        
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
                    <p style="font-size:1.1rem;">Краткое описание психотипов по методике <b>В.В. Пономаренко</b>:</p>
                    <div class="radical-method-block"><h4>🎯 1. Паранойяльный (Целеустремлённый)</h4><div class="radical-desc">Лидер, стратег, ориентированный на масштабные цели. Высокий тонус, напор.</div><div class="radical-behavior"><b>Поведение:</b> Упрям, настойчив, пренебрегает деталями. Речь уверенная.</div></div>
                    <div class="radical-method-block"><h4>🎭 2. Истероидный (Демонстративный)</h4><div class="radical-desc">Артист, жаждет внимания. Эмоционален, выразителен.</div><div class="radical-behavior"><b>Поведение:</b> Драматизирует, стремится быть в центре. Коммуникабелен.</div></div>
                    <div class="radical-method-block"><h4>📊 3. Эпилептоидный (Организатор)</h4><div class="radical-desc">Прагматик, любит порядок, структуру, контроль.</div><div class="radical-behavior"><b>Поведение:</b> Педантичен, пунктуален, может быть вспыльчив при нарушении правил.</div></div>
                    <div class="radical-method-block"><h4>🧠 4. Шизоидный (Творческий)</h4><div class="radical-desc">Мыслитель, погружён в свой мир идей.</div><div class="radical-behavior"><b>Поведение:</b> Отстранён от быта, речь абстрактная, эмоции сдержаны.</div></div>
                    <div class="radical-method-block"><h4>⚡ 5. Гипертимный (Активный)</h4><div class="radical-desc">Оптимист, энергичный, ищет новые впечатления.</div><div class="radical-behavior"><b>Поведение:</b> Легкомыслен, не любит рутину, склонен к риску.</div></div>
                    <div class="radical-method-block"><h4>🛡 6. Тревожный (Чувствительный)</h4><div class="radical-desc">Осторожный, ответственный, предусмотрительный.</div><div class="radical-behavior"><b>Поведение:</b> Избегает конфликтов, мнителен, нуждается в поддержке.</div></div>
                    <div class="radical-method-block"><h4>💖 7. Эмотивный (Сопереживающий)</h4><div class="radical-desc">Добрый, мягкий, высокая эмпатия.</div><div class="radical-behavior"><b>Поведение:</b> Чуткий, не выносит жестокости, нерешителен.</div></div>
                    <div class="key-points"><p><b>Ключевые особенности:</b> Радикал — устойчивая акцентуация. В чистом виде редки. Личность — сочетание 2-4 радикалов. Методика прикладная.</p></div>
                    <div class="nav-buttons">
                        <button class="nav-btn" id="backFromMethod">🏠 На главную</button>
                        <button class="nav-btn" id="startTestFromMethod">▶ Тест</button>
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
                
                // Тип результата
                const typeBadge = item.resultType === 'manual' ? 
                    '<span class="history-item-type">📝 Ручной</span>' : '';
                
                // Информация о пользователе
                let userText = '';
                if (item.user) {
                    const fullName = [item.user.lastName, item.user.firstName, item.user.patronymic].filter(Boolean).join(' ');
                    userText = `<div class="history-item-user">👤 ${fullName || item.user.firstName} · ${item.user.age} лет</div>`;
                }
                
                // Все 7 радикалов с tooltip
                let radicalsHtml = '<div class="history-radicals-list">';
                sorted.forEach(([code, val]) => {
                    const [name, emoji] = RADICAL_NAMES[code];
                    radicalsHtml += `<span class="history-radical-tag" title="${name}">${emoji} ${val}%</span>`;
                });
                radicalsHtml += '</div>';
                
                return `
                    <div class="history-item">
                        <div class="history-item-header">
                            <span class="history-item-date">${index + 1}. ${date}</span>
                            <span class="history-item-leading">${leadEmoji} ${leadName}</span>
                        </div>
                        ${typeBadge}
                        ${userText}
                        ${radicalsHtml}
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
        
        // Проценты - все 7 радикалов
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