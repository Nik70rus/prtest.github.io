// ========== ГЕНЕРАТОР ПЕРСОНАЛИЗИРОВАННОГО ОТЧЁТА ==========

class ProfileGenerator {
    constructor() {
        this.texts = {
            strengths: STRENGTH_BLOCKS,
            conflicts: CONFLICT_PAIRS,
            growth: GROWTH_ZONES,
            work: WORK_RECOMMENDATIONS,
            relationships: RELATIONSHIP_RECOMMENDATIONS,
            templates: PROFILE_TEMPLATES
        };
    }

    // ===== АНАЛИЗ ПРОФИЛЯ =====
    analyzeProfile(percentages) {
        const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
        const [top1, top2, top3] = sorted;
        const leading = top1[0];
        const leadingPercent = top1[1];
        
        // Определение типа профиля
        let profileType;
        if (leadingPercent < 25) {
            profileType = 'balanced';
        } else if (leadingPercent > 40) {
            profileType = 'dominant';
        } else if (leadingPercent > 30) {
            profileType = 'mixed';
        } else {
            profileType = 'balanced';
        }

        // Проверка на экстремальные значения
        const hasExtreme = sorted.some(([, val]) => val > 50 || val < 3);
        if (hasExtreme) profileType = 'extreme';

        // Топ-3 радикала (>= 15%)
        const topRadicals = sorted.filter(([, val]) => val >= 15).slice(0, 3);
        
        // Низкие радикалы (<= 8%)
        const lowRadicals = sorted.filter(([, val]) => val <= 8);

        // Поиск конфликтов
        const conflicts = this.findConflicts(sorted);

        // Название профиля
        const title = this.getProfileTitle(profileType);

        return {
            profileType,
            leading,
            leadingPercent,
            sorted,
            topRadicals,
            lowRadicals,
            conflicts,
            title,
            percentages
        };
    }

    // ===== ПОИСК КОНФЛИКТОВ =====
    findConflicts(sorted) {
        const conflicts = [];
        const radicalMap = Object.fromEntries(sorted);
        
        for (let [pair, description] of Object.entries(CONFLICT_PAIRS)) {
            const [r1, r2] = pair.split('_');
            if (radicalMap[r1] >= 15 && radicalMap[r2] >= 15) {
                conflicts.push({ pair, description, r1, r2, v1: radicalMap[r1], v2: radicalMap[r2] });
            }
        }
        
        return conflicts;
    }

    // ===== НАЗВАНИЕ ПРОФИЛЯ =====
    getProfileTitle(profileType) {
        const titles = PROFILE_TITLES[profileType] || PROFILE_TITLES['mixed'];
        const randomIndex = Math.floor(Math.random() * titles.length);
        return titles[randomIndex];
    }

    // ===== ФОРМАТИРОВАНИЕ РАДИКАЛОВ =====
    formatRadicals(radicals) {
        return radicals.map(([code, val]) => 
            `${RADICAL_NAMES[code][0]} (${val}%)`
        ).join(', ');
    }

    // ===== ДИНАМИКА ЯДРА =====
    getCoreDynamics(topRadicals) {
        const dynamics = [];
        const codes = topRadicals.map(([c]) => c);
        
        if (codes.includes('anxious') && codes.includes('hypertymic')) {
            dynamics.push('желанием безопасности и жаждой активности');
        }
        if (codes.includes('hysteroid') && codes.includes('epileptoid')) {
            dynamics.push('стремлением к свободе и потребностью в порядке');
        }
        if (codes.includes('paranoid') && codes.includes('emotive')) {
            dynamics.push('целеустремленностью и заботой о чувствах');
        }
        if (codes.includes('schizoid') && codes.includes('hypertymic')) {
            dynamics.push('потребностью в уединении и социальной активностью');
        }
        if (codes.includes('anxious') && codes.includes('paranoid')) {
            dynamics.push('осторожностью и готовностью к риску');
        }
        
        if (dynamics.length === 0) {
            dynamics.push('различными аспектами вашей личности');
        }
        
        return dynamics.join(', ');
    }

    // ===== НИЗКИЙ РАДИКАЛ - ТРАЙТ =====
    getLowTrait(lowRadicals) {
        if (lowRadicals.length === 0) return 'сбалансированность всех сфер';
        
        const [code] = lowRadicals[0];
        const traits = {
            emotive: 'прагматизм и несклонность к глубокой сентиментальности',
            anxious: 'смелость и готовность к риску',
            epileptoid: 'гибкость и адаптивность к изменениям',
            hypertymic: 'спокойствие и способность к концентрации',
            hysteroid: 'скромность и независимость от оценок',
            paranoid: 'отсутствие давления грандиозных целей',
            schizoid: 'практичность и ориентация на реальность'
        };
        
        return traits[code] || 'индивидуальную особенность';
    }

    // ===== ГЕНЕРАЦИЯ ЗАГОЛОВКА =====
    generateHeader(analysis) {
        const { profileType, title, topRadicals, lowRadicals, sorted } = analysis;
        
        const coreRadicals = this.formatRadicals(topRadicals);
        const coreCount = topRadicals.length >= 2 ? topRadicals.length : 'несколько';
        const coreDynamics = this.getCoreDynamics(topRadicals);
        const lowRadical = lowRadicals.length > 0 ? 
            `${RADICAL_NAMES[lowRadicals[0][0]][0]} (${lowRadicals[0][1]}%)` : 
            'отсутствие выраженных низких радикалов';
        const lowTrait = this.getLowTrait(lowRadicals);

        let header = '';

        if (profileType === 'balanced') {
            header = this.texts.templates.balanced_intro.replace('{title}', title) + '\n\n';
            header += this.texts.templates.balanced_core
                .replace('{core_count}', coreCount)
                .replace('{core_radicals}', coreRadicals)
                .replace('{core_dynamics}', coreDynamics)
                .replace('{low_radical}', lowRadical)
                .replace('{low_trait}', lowTrait);
        } else if (profileType === 'dominant') {
            const [lead] = sorted;
            header = this.texts.templates.dominant_intro.replace('{title}', title) + '\n\n';
            header += this.texts.templates.dominant_core
                .replace('{leading_name}', RADICAL_NAMES[lead[0]][0])
                .replace('{leading_percent}', lead[1])
                .replace('{leading_description}', RADICAL_DESCRIPTIONS[lead[0]]);
        } else {
            header = this.texts.templates.mixed_intro.replace('{title}', title) + '\n\n';
            header += this.texts.templates.mixed_core
                .replace('{core_radicals}', coreRadicals);
        }

        return header;
    }

    // ===== ГЕНЕРАЦИЯ СИЛЬНЫХ СТОРОН =====
    generateStrengths(analysis) {
        const { topRadicals, sorted } = analysis;
        
        let text = `📌 Детальная характеристика:\n\n`;
        text += `💪 Сильные стороны:\n`;

        // Адаптивность (Г + Т + Эпи >= 15%)
        const hasAdaptivity = sorted.find(([c]) => c === 'hypertymic')?.[1] >= 15 &&
                              sorted.find(([c]) => c === 'anxious')?.[1] >= 15 &&
                              sorted.find(([c]) => c === 'epileptoid')?.[1] >= 15;
        
        if (hasAdaptivity) {
            text += `• ${this.texts.templates.strength_adaptivity}\n`;
        }

        // Баланс активности и осторожности (Г + Т)
        const hasBalance = sorted.find(([c]) => c === 'hypertymic')?.[1] >= 15 &&
                          sorted.find(([c]) => c === 'anxious')?.[1] >= 15;
        
        if (hasBalance && !hasAdaptivity) {
            text += `• ${this.texts.templates.strength_balance}\n`;
        }

        // Прагматизм при низком эмотивном
        const emotivePercent = sorted.find(([c]) => c === 'emotive')?.[1] || 0;
        if (emotivePercent <= 8) {
            text += `• ${this.texts.templates.strength_pragmatic}\n`;
        }

        // Амбиции (И + П)
        const hasAmbition = sorted.find(([c]) => c === 'hysteroid')?.[1] >= 15 &&
                           sorted.find(([c]) => c === 'paranoid')?.[1] >= 15;
        
        if (hasAmbition) {
            text += `• ${this.texts.templates.strength_ambition}\n`;
        }

        // Сильные стороны топ-3 радикалов
        topRadicals.slice(0, 3).forEach(([code, val]) => {
            if (val >= 15) {
                text += `• ${RADICAL_NAMES[code][0]} (${val}%): ${this.texts.strengths[code]}\n`;
            }
        });

        return text;
    }

    // ===== ГЕНЕРАЦИЯ ЗОН РОСТА =====
    generateGrowthZones(analysis) {
        const { sorted, conflicts, lowRadicals } = analysis;
        
        let text = `\n⚠️ Зоны роста (потенциальные сложности):\n`;

        // Внутренние конфликты
        if (conflicts.length > 0) {
            const [mainConflict] = conflicts;
            text += `• ${this.texts.templates.growth_conflict.replace('{conflict_description}', mainConflict.description)}\n`;
        }

        // Поверхностность (Г + низкий Эм)
        const hypertymic = sorted.find(([c]) => c === 'hypertymic')?.[1] || 0;
        const emotive = sorted.find(([c]) => c === 'emotive')?.[1] || 0;
        
        if (hypertymic >= 15 && emotive <= 8) {
            text += `• ${this.texts.templates.growth_surface}\n`;
        }

        // Манипуляции (И + П + низкий Эм)
        const hysteroid = sorted.find(([c]) => c === 'hysteroid')?.[1] || 0;
        const paranoid = sorted.find(([c]) => c === 'paranoid')?.[1] || 0;
        
        if (hysteroid >= 15 && paranoid >= 15 && emotive <= 8) {
            text += `• ${this.texts.templates.growth_manipulation}\n`;
        }

        // Сложности с близостью
        if (hypertymic >= 15 && hysteroid >= 15) {
            text += `• ${this.texts.templates.growth_intimacy}\n`;
        }

        // Зоны роста для низких радикалов
        lowRadicals.forEach(([code, val]) => {
            if (this.texts.growth[`low_${code}`]) {
                text += `• ${this.texts.growth[`low_${code}`]}\n`;
            }
        });

        return text;
    }

    // ===== РЕКОМЕНДАЦИИ ПО РАБОТЕ =====
    generateWorkRecommendations(analysis) {
        const { sorted, topRadicals, percentages } = analysis;
        
        let text = `\n💼 Рекомендации в работе и карьере:\n`;
        
        // Идеальные роли
        const topProfessions = topRadicals.slice(0, 2).flatMap(([code]) => PROFESSIONS[code]).slice(0, 5);
        const uniqueProfs = [...new Set(topProfessions)];
        
        // Среда работы
        let workEnvironment = 'стабильная среда с понятными задачами';
        if (sorted.find(([c]) => c === 'hypertymic')?.[1] >= 15 ||
            sorted.find(([c]) => c === 'hysteroid')?.[1] >= 15) {
            workEnvironment = 'динамичная среда с четкими KPI, где нужно общаться с людьми и решать оперативные задачи';
        }
        
        text += this.texts.templates.work_roles
            .replace('{professions}', uniqueProfs.join(', '))
            .replace('{work_environment}', workEnvironment) + '\n\n';

        text += `Что критично важно:\n`;

        // Четкие границы (Эпи)
        if (sorted.find(([c]) => c === 'epileptoid')?.[1] >= 15) {
            text += `• ${this.texts.templates.work_critical_structure}\n`;
        }

        // Признание (И + П)
        if (sorted.find(([c]) => c === 'hysteroid')?.[1] >= 15 || 
            sorted.find(([c]) => c === 'paranoid')?.[1] >= 15) {
            text += `• ${this.texts.templates.work_critical_recognition}\n`;
        }

        // Смена деятельности (Г)
        if (sorted.find(([c]) => c === 'hypertymic')?.[1] >= 15) {
            text += `• ${this.texts.templates.work_critical_variety}\n`;
        }

        return text;
    }

    // ===== РЕКОМЕНДАЦИИ ПО ОТНОШЕНИЯМ =====
    generateRelationshipRecommendations(analysis) {
        const { sorted, lowRadicals } = analysis;
        
        let text = `\n❤️ Рекомендации в любви и отношениях:\n`;
        
        text += `Вы — надежный и деятельный партнер. Вы не склонны к драмам на пустом месте, готовы решать бытовые проблемы и организовывать досуг.\n`;

        // Низкий эмотивный
        if (lowRadicals.find(([c]) => c === 'emotive')) {
            text += `\n• ${this.texts.templates.relationship_partner}\n`;
        }

        // Учитесь чувствам
        const emotive = sorted.find(([c]) => c === 'emotive')?.[1] || 0;
        if (emotive <= 12) {
            text += `\n• ${this.texts.templates.relationship_feelings}\n`;
        }

        // Тихие зоны (Г)
        if (sorted.find(([c]) => c === 'hypertymic')?.[1] >= 15) {
            text += `\n• ${this.texts.templates.relationship_quiet}\n`;
        }

        return text;
    }

    // ===== РЕКОМЕНДАЦИИ ПО ОБЩЕНИЮ =====
    generateCommunicationRecommendations(analysis) {
        const { sorted, conflicts } = analysis;
        
        let text = `\n💬 Рекомендации в общении и саморазвитии:\n`;

        // Осознание циклов
        const hasConflict = conflicts.length > 0;
        if (hasConflict) {
            text += `• ${this.texts.templates.communication_cycles}\n`;
        }

        // Глубина vs Ширина
        const hypertymic = sorted.find(([c]) => c === 'hypertymic')?.[1] || 0;
        if (hypertymic >= 15) {
            text += `\n• ${this.texts.templates.communication_depth}\n`;
        }

        // Тревожность как планирование
        const anxious = sorted.find(([c]) => c === 'anxious')?.[1] || 0;
        if (anxious >= 15) {
            text += `\n• ${this.texts.templates.communication_anxious}\n`;
        }

        // Шизоидная часть
        const schizoid = sorted.find(([c]) => c === 'schizoid')?.[1] || 0;
        if (schizoid >= 10) {
            text += `\n• ${this.texts.templates.communication_schizoid}\n`;
        }

        // Прагматизм
        const emotive = sorted.find(([c]) => c === 'emotive')?.[1] || 0;
        if (emotive <= 10) {
            text += `\n• ${this.texts.templates.communication_pragmatic}\n`;
        }

        return text;
    }

    // ===== ГЛАВНЫЙ ВЫВОД =====
    generateConclusion(analysis) {
        const { profileType, leading, sorted } = analysis;
        
        let text = `\n🎯 Главный вывод:\n`;

        if (profileType === 'balanced') {
            text += this.texts.templates.conclusion_balanced;
        } else if (profileType === 'dominant') {
            text += this.texts.templates.conclusion_dominant
                .replace('{leading_name}', RADICAL_NAMES[leading][0]);
        } else {
            text += this.texts.templates.conclusion_mixed;
        }

        return text;
    }

    // ===== ПОЛНАЯ ГЕНЕРАЦИЯ ОТЧЁТА (ТЕКСТ) =====
    generateFullReport(percentages) {
        const analysis = this.analyzeProfile(percentages);
        
        let report = '';
        report += this.generateHeader(analysis);
        report += this.generateStrengths(analysis);
        report += this.generateGrowthZones(analysis);
        report += this.generateWorkRecommendations(analysis);
        report += this.generateRelationshipRecommendations(analysis);
        report += this.generateCommunicationRecommendations(analysis);
        report += this.generateConclusion(analysis);

        return {
            report,
            analysis
        };
    }

    // ===== ГЕНЕРАЦИЯ HTML ДЛЯ ОТЧЁТА =====
    generateHTMLReport(percentages) {
        const { report, analysis } = this.generateFullReport(percentages);
        
        // Разбиваем на секции для HTML
        const sections = report.split(/\n\n(?=[📌|️|💼|❤️|💬|🎯])/);
        
        let html = `<div class="profile-report">`;
        
        sections.forEach(section => {
            if (section.includes('📌')) {
                html += `<h3>📌 Детальная характеристика</h3>`;
                html += this.formatSectionContent(section.replace('📌 Детальная характеристика:', ''));
            } else if (section.includes('⚠️')) {
                html += `<h3>⚠️ Зоны роста</h3>`;
                html += `<div class="warning">`;
                html += this.formatSectionContent(section.replace('⚠️ Зоны роста (потенциальные сложности):', ''));
                html += `</div>`;
            } else if (section.includes('💼')) {
                html += `<h3>💼 Работа и карьера</h3>`;
                html += this.formatSectionContent(section.replace('💼 Рекомендации в работе и карьере:', ''));
            } else if (section.includes('❤️')) {
                html += `<h3>❤️ Отношения</h3>`;
                html += this.formatSectionContent(section.replace('❤️ Рекомендации в любви и отношениях:', ''));
            } else if (section.includes('💬')) {
                html += `<h3>💬 Общение и развитие</h3>`;
                html += this.formatSectionContent(section.replace('💬 Рекомендации в общении и саморазвитии:', ''));
            } else if (section.includes('🎯')) {
                html += `<h3>🎯 Главный вывод</h3>`;
                html += `<div class="success">`;
                html += this.formatSectionContent(section.replace('🎯 Главный вывод:', ''));
                html += `</div>`;
            } else {
                html += this.formatSectionContent(section);
            }
        });
        
        html += `</div>`;
        
        return html;
    }

    // ===== ФОРМАТИРОВАНИЕ СЕКЦИИ =====
    formatSectionContent(content) {
        let html = '';
        const lines = content.trim().split('\n');
        
        lines.forEach(line => {
            if (line.startsWith('•')) {
                html += `<p>${line}</p>`;
            } else if (line.trim()) {
                html += `<p>${line}</p>`;
            }
        });
        
        return html;
    }

    // ===== ГЕНЕРАЦИЯ TXT ОТЧЁТА =====
    generateTXTReport(percentages, userInfo, date = new Date()) {
        const { report, analysis } = this.generateFullReport(percentages);
        
        let txt = `═══════════════════════════════════════════════════\n`;
        txt += `       ПСИХОРАДИКАЛЬНЫЙ ПРОФИЛЬ · ТЕСТ ПОНОМАРЕНКО\n`;
        txt += `═══════════════════════════════════════════════════\n\n`;
        txt += `📅 Дата прохождения: ${date.toLocaleString('ru-RU')}\n\n`;
        
        // Информация о пользователе
        if (userInfo) {
            txt += `───────────────────────────────────────────────────\n`;
            txt += `                 ПОЛЬЗОВАТЕЛЬ\n`;
            txt += `───────────────────────────────────────────────────\n`;
            if (userInfo.lastName) txt += `Фамилия: ${userInfo.lastName}\n`;
            txt += `Имя: ${userInfo.firstName}\n`;
            if (userInfo.patronymic) txt += `Отчество: ${userInfo.patronymic}\n`;
            txt += `Дата рождения: ${userInfo.dateOfBirth}\n`;
            txt += `Возраст: ${userInfo.age} лет\n\n`;
        }
        
        txt += `───────────────────────────────────────────────────\n`;
        txt += `                    ПРОЦЕНТЫ\n`;
        txt += `───────────────────────────────────────────────────\n`;
        
        const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
        for (let [code, val] of sorted) {
            const [name, emoji] = RADICAL_NAMES[code] || [code, '•'];
            txt += `${emoji} ${name}: ${val}%\n`;
        }
        
        txt += `\n───────────────────────────────────────────────────\n`;
        txt += `                 ВЕДУЩИЙ РАДИКАЛ\n`;
        txt += `───────────────────────────────────────────────────\n`;
        const [leadName, leadEmoji, leadSub] = RADICAL_NAMES[analysis.leading] || [analysis.leading, '', ''];
        txt += `${leadEmoji} ${leadName} (${leadSub}) — ${analysis.leadingPercent}%\n`;
        txt += `${RADICAL_DESCRIPTIONS[analysis.leading]}\n`;
        
        txt += `\n═══════════════════════════════════════════════════\n`;
        txt += `                 ПОЛНЫЙ ОТЧЁТ\n`;
        txt += `═══════════════════════════════════════════════════\n\n`;
        txt += report;
        
        txt += `\n\n═══════════════════════════════════════════════════\n`;
        txt += `              СГЕНЕРИРОВАНО АВТОМАТИЧЕСКИ\n`;
        txt += `═══════════════════════════════════════════════════\n`;
        
        return txt;
    }

    // ===== ГЕНЕРАЦИЯ СООБЩЕНИЯ ДЛЯ КОПИРОВАНИЯ =====
    generateCopyAllText(percentages, userInfo, date = new Date()) {
        const { report, analysis } = this.generateFullReport(percentages);
        
        let text = `🧠 ПСИХОРАДИКАЛЬНЫЙ ПРОФИЛЬ · ТЕСТ ПОНОМАРЕНКО\n`;
        text += `📅 Дата: ${date.toLocaleString('ru-RU')}\n\n`;
        
        // Информация о пользователе
        if (userInfo) {
            const fullName = [userInfo.lastName, userInfo.firstName, userInfo.patronymic].filter(Boolean).join(' ');
            text += `👤 ${fullName || userInfo.firstName}\n`;
            text += `🎂 Возраст: ${userInfo.age} лет\n\n`;
        }
        
        // Проценты
        text += `📊 ПРОЦЕНТНОЕ СООТНОШЕНИЕ:\n`;
        const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
        for (let [code, val] of sorted) {
            const [name, emoji] = RADICAL_NAMES[code] || [code, '•'];
            text += `${emoji} ${name}: ${val}%\n`;
        }
        
        const [leadName, leadEmoji] = RADICAL_NAMES[analysis.leading] || [analysis.leading, ''];
        text += `\n🏆 ВЕДУЩИЙ: ${leadEmoji} ${leadName} (${analysis.leadingPercent}%)\n`;
        text += `📝 ${RADICAL_DESCRIPTIONS[analysis.leading]}\n`;
        
        text += `\n─────────────────────────────\n`;
        text += `ПОЛНЫЙ ОТЧЁТ:\n`;
        text += `─────────────────────────────\n\n`;
        text += report;
        
        return text;
    }

    // ===== ГЕНЕРАЦИЯ PDF (ИСПРАВЛЕНО!) =====
    async generatePDF(percentages, userInfo, date = new Date()) {
        const { report, analysis } = this.generateFullReport(percentages);
        const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
        const [leadName, leadEmoji] = RADICAL_NAMES[analysis.leading] || [analysis.leading, ''];
        
        // Создаём временный элемент для PDF
        const content = document.createElement('div');
        content.style.padding = '20px';
        content.style.fontFamily = 'Arial, sans-serif';
        content.style.fontSize = '14px';
        content.style.lineHeight = '1.6';
        
        const fullName = userInfo ? 
            [userInfo.lastName, userInfo.firstName, userInfo.patronymic].filter(Boolean).join(' ') : 
            'Пользователь';
        
        let percentagesHtml = '';
        for (let [code, val] of sorted) {
            const [name, emoji] = RADICAL_NAMES[code] || [code, '•'];
            percentagesHtml += `<p>${emoji} ${name}: <strong>${val}%</strong></p>`;
        }
        
        content.innerHTML = `
            <h1 style="color: #1A2A4F; text-align: center; margin-bottom: 10px;">Психорадикальный Профиль</h1>
            <p style="text-align: center; color: #666; margin-bottom: 20px;">Тест В.В. Пономаренко</p>
            
            <div style="background: #f0f7ff; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p><strong>👤 Пользователь:</strong> ${fullName}</p>
                <p><strong>📅 Дата:</strong> ${date.toLocaleString('ru-RU')}</p>
                ${userInfo ? `<p><strong>🎂 Возраст:</strong> ${userInfo.age} лет</p>` : ''}
            </div>
            
            <h2 style="color: #1A2A4F; border-bottom: 2px solid #3a6ea5; padding-bottom: 10px; margin: 20px 0 15px;">📊 Процентное соотношение</h2>
            ${percentagesHtml}
            
            <div style="background: #e0eaf8; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <h3 style="color: #1A2A4F; margin-bottom: 10px;">🏆 Ведущий радикал: ${leadEmoji} ${leadName}</h3>
                <p>${RADICAL_DESCRIPTIONS[analysis.leading]}</p>
            </div>
            
            <h2 style="color: #1A2A4F; border-bottom: 2px solid #3a6ea5; padding-bottom: 10px; margin: 30px 0 15px;">📋 Полный отчёт</h2>
            <div style="white-space: pre-wrap; line-height: 1.6;">${report}</div>
            
            <p style="text-align: center; color: #999; margin-top: 40px; font-size: 12px;">
                Сгенерировано автоматически · Тест 7 психорадикалов В.В. Пономаренко
            </p>
        `;
        
        document.body.appendChild(content);
        
        const opt = {
            margin: 10,
            filename: `психорадикалы_${date.toISOString().slice(0,10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        try {
            await html2pdf().set(opt).from(content).save();
        } catch (err) {
            console.error('PDF generation error:', err);
            throw err;
        } finally {
            document.body.removeChild(content);
        }
    }

    // ===== РАСЧЁТ ВОЗРАСТА =====
    calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    // ===== ПРОВЕРКА ВОЗРАСТА =====
    isAgeValid(dateOfBirth) {
        const age = this.calculateAge(dateOfBirth);
        return {
            isValid: age >= 16,
            age: age,
            message: age < 16 ? VALIDATION_MESSAGES.age_warning_text : ''
        };
    }

    // ===== ПРОВЕРКА СУММЫ ПРОЦЕНТОВ =====
    validatePercentages(percentages) {
        const values = Object.values(percentages);
        const sum = values.reduce((a, b) => a + b, 0);
        
        // Проверка на отрицательные значения и значения > 100
        const invalidValues = values.some(v => v < 0 || v > 100);
        
        return {
            isValid: sum === 100 && !invalidValues,
            sum: sum,
            invalidValues: invalidValues
        };
    }
}

// ===== ЭКСПОРТ =====
const profileGenerator = new ProfileGenerator();