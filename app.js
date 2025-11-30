/* ===================================
   RUNNER R-PERFORMANCE TRACKER V2.0
   Advanced Trading Analytics System
   With Flexible Strategy & Deviation Tracking
   =================================== */

// ===================================
// STATE MANAGEMENT
// ===================================
class TradingSystem {
    constructor() {
        this.settings = this.loadSettings();
        this.trades = this.loadTrades();
        this.currentPage = 1;
        this.itemsPerPage = 5;
        this.chart = null;
        this.init();
    }

    // Default Settings
    getDefaultSettings() {
        return {
            initialCapital: 50000,
            targetGrowth: 8,
            riskPerTrade: 0.5,
            rLevel: 1.2,
            lockPercentage: 70
        };
    }

    // Load Settings from LocalStorage
    loadSettings() {
        const saved = localStorage.getItem('runnerSettings');
        return saved ? JSON.parse(saved) : this.getDefaultSettings();
    }

    // Save Settings to LocalStorage
    saveSettings() {
        localStorage.setItem('runnerSettings', JSON.stringify(this.settings));
    }

    // Load Trades from LocalStorage
    loadTrades() {
        const saved = localStorage.getItem('runnerTrades');
        return saved ? JSON.parse(saved) : [];
    }

    // Save Trades to LocalStorage
    saveTrades() {
        localStorage.setItem('runnerTrades', JSON.stringify(this.trades));
    }

    // Initialize System
    init() {
        this.setupEventListeners();
        this.initChart();
        this.updateDashboard();
        this.renderTradeHistory();
    }

    // ===================================
    // CHART SYSTEM
    // ===================================
    initChart() {
        const ctx = document.getElementById('balanceChart').getContext('2d');

        // Chart.js Configuration
        Chart.defaults.color = '#8b949e';
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Bakiye',
                    data: [],
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#58a6ff',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#58a6ff',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#161b22',
                        titleColor: '#e6edf3',
                        bodyColor: '#8b949e',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                return `Bakiye: ${this.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: '#30363d' },
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;

        // Sort trades by date ascending for chart
        const sortedTrades = [...this.trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const labels = ['Başlangıç', ...sortedTrades.map((_, i) => `İşlem ${i + 1}`)];
        const data = [this.settings.initialCapital, ...sortedTrades.map(t => t.balance)];

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }

    // ===================================
    // CALCULATIONS
    // ===================================

    // Calculate Fixed Risk Amount (TL)
    getFixedRiskAmount() {
        return (this.settings.initialCapital * this.settings.riskPerTrade) / 100;
    }

    // Calculate Target Profit (TL)
    getTargetProfit() {
        return (this.settings.initialCapital * this.settings.targetGrowth) / 100;
    }

    // Calculate Trade Profit/Loss with Flexible Parameters
    calculateTradeResult(result, firstCloseRRR, firstClosePercent, runnerCloseRRR) {
        const riskAmount = this.getFixedRiskAmount();

        switch (result) {
            case 'loss':
                return {
                    total: -riskAmount,
                    breakdown: {
                        loss: -riskAmount
                    }
                };

            case 'be':
                // BE: First part profit, runner part closes at entry (0 profit)
                const firstPercent = firstClosePercent / 100;
                const beFirstProfit = firstPercent * firstCloseRRR * riskAmount;
                const beRunnerResult = 0; // Runner hits entry

                return {
                    total: beFirstProfit,
                    breakdown: {
                        firstClose: beFirstProfit,
                        firstCloseRRR: firstCloseRRR,
                        firstClosePercent: firstClosePercent,
                        runnerClose: beRunnerResult,
                        runnerPercent: 100 - firstClosePercent
                    }
                };

            case 'win':
                // Win: Calculate both parts
                const lockPercent = firstClosePercent / 100;
                const runnerPercent = 1 - lockPercent;

                const guaranteedProfit = lockPercent * firstCloseRRR * riskAmount;
                const runnerProfit = runnerPercent * runnerCloseRRR * riskAmount;

                return {
                    total: guaranteedProfit + runnerProfit,
                    breakdown: {
                        firstClose: guaranteedProfit,
                        firstCloseRRR: firstCloseRRR,
                        firstClosePercent: firstClosePercent,
                        runnerClose: runnerProfit,
                        runnerCloseRRR: runnerCloseRRR,
                        runnerPercent: (1 - lockPercent) * 100
                    }
                };

            default:
                return { total: 0, breakdown: {} };
        }
    }

    // Calculate Current Balance
    getCurrentBalance() {
        const totalProfitLoss = this.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
        return this.settings.initialCapital + totalProfitLoss;
    }

    // Calculate Net Profit
    getNetProfit() {
        return this.trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
    }

    // Calculate Win Rate
    getWinRate() {
        if (this.trades.length === 0) return 0;
        const wins = this.trades.filter(t => t.result === 'win').length;
        return (wins / this.trades.length) * 100;
    }

    // Calculate Average RRR for Winning Trades
    getAverageRRR() {
        const winningTrades = this.trades.filter(t => t.result === 'win');
        if (winningTrades.length === 0) return 0;

        const totalRRR = winningTrades.reduce((sum, trade) => {
            return sum + (trade.breakdown?.runnerCloseRRR || 0);
        }, 0);
        return totalRRR / winningTrades.length;
    }

    // Calculate Max Drawdown
    calculateMaxDrawdown() {
        if (this.trades.length === 0) return 0;

        let maxPeak = this.settings.initialCapital;
        let maxDD = 0;

        // Sort trades by date ascending
        const sortedTrades = [...this.trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        for (const trade of sortedTrades) {
            if (trade.balance > maxPeak) {
                maxPeak = trade.balance;
            }

            const dd = ((maxPeak - trade.balance) / maxPeak) * 100;
            if (dd > maxDD) {
                maxDD = dd;
            }
        }

        return maxDD;
    }

    // Calculate Remaining Profit to Target
    getRemainingProfit() {
        return this.getTargetProfit() - this.getNetProfit();
    }

    // Calculate Progress Percentage
    getProgressPercentage() {
        const progress = (this.getNetProfit() / this.getTargetProfit()) * 100;
        return Math.max(0, Math.min(100, progress));
    }

    // Estimate Trades Needed
    getEstimatedTradesNeeded() {
        const avgProfit = this.getAverageTradeProfit();
        if (avgProfit <= 0) return 0;

        const remaining = this.getRemainingProfit();
        return Math.ceil(remaining / avgProfit);
    }

    // Get Average Trade Profit
    getAverageTradeProfit() {
        if (this.trades.length === 0) return 0;
        return this.getNetProfit() / this.trades.length;
    }

    // ===================================
    // STRATEGY DEVIATION ANALYSIS
    // ===================================

    analyzeStrategyDeviation(firstCloseRRR, firstClosePercent) {
        const targetRRR = this.settings.rLevel;
        const targetPercent = this.settings.lockPercentage;

        const rrrDeviation = firstCloseRRR - targetRRR;
        const percentDeviation = firstClosePercent - targetPercent;

        let warnings = [];

        // RRR Deviation Check
        if (Math.abs(rrrDeviation) > 0.2) {
            if (rrrDeviation < 0) {
                // Early close
                const riskAmount = this.getFixedRiskAmount();
                const actualProfit = (firstClosePercent / 100) * firstCloseRRR * riskAmount;
                const targetProfit = (targetPercent / 100) * targetRRR * riskAmount;
                const difference = targetProfit - actualProfit;

                warnings.push({
                    type: 'danger',
                    icon: '⚠️',
                    title: 'ERKEN KAPANIŞ UYARISI!',
                    message: `İlk kapanışı ${firstCloseRRR.toFixed(1)}R'de yaptınız (hedef: ${targetRRR}R). Bu, risk yönetiminizi zayıflatır.\n\nBir sonraki işlem SL olursa:\n• Mevcut strateji: ${this.formatCurrency(actualProfit)} kâr - ${this.formatCurrency(riskAmount)} kayıp = ${this.formatCurrency(actualProfit - riskAmount)} net\n• Hedef strateji: ${this.formatCurrency(targetProfit)} kâr - ${this.formatCurrency(riskAmount)} kayıp = ${this.formatCurrency(targetProfit - riskAmount)} net\n\n⚠️ Fark: ${this.formatCurrency(difference)} daha az koruma!`
                });
            } else {
                // Aggressive close
                warnings.push({
                    type: 'warning',
                    icon: '🔥',
                    title: 'AGRESİF STRATEJI!',
                    message: `İlk kapanışı ${firstCloseRRR.toFixed(1)}R'de yaptınız (hedef: ${targetRRR}R). Bu daha fazla kâr sağlar ancak riski artırır.\n\n✅ Avantaj: Daha hızlı hesap büyümesi\n⚠️ Risk: Fiyat geri dönerse daha fazla kazanç kaybı\n\n💡 Tutarlılık önemlidir. Bu stratejiyi sürdürebilir misiniz?`
                });
            }
        }

        // Percent Deviation Check
        if (Math.abs(percentDeviation) > 10) {
            if (percentDeviation < 0) {
                warnings.push({
                    type: 'info',
                    icon: '📊',
                    title: 'RUNNER POTANSİYELİ ARTTI',
                    message: `Pozisyonun %${firstClosePercent}'ini kapattınız (hedef: %${targetPercent}). Kalan %${100 - firstClosePercent} ile daha büyük runner kazançları mümkün, ama BE/SL gelirse daha fazla kayıp riski var.\n\n💡 Tutarlı olun: Her işlemde aynı oranı kullanın.`
                });
            } else {
                warnings.push({
                    type: 'info',
                    icon: '🛡️',
                    title: 'DAHA FAZLA GARANTİ',
                    message: `Pozisyonun %${firstClosePercent}'ini kapattınız (hedef: %${targetPercent}). Daha fazla garantili kâr aldınız ama runner potansiyelinizi azalttınız.\n\n💡 Tutarlılık anahtardır!`
                });
            }
        }

        return warnings;
    }

    // ===================================
    // SMART FEEDBACK SYSTEM
    // ===================================

    generateFeedback(trade) {
        const consecutiveLosses = this.getConsecutiveLosses();
        const beCount = this.getRecentBECount();
        const netProfit = this.getNetProfit();
        const targetProfit = this.getTargetProfit();

        // Target Completed
        if (netProfit >= targetProfit) {
            return {
                type: 'success',
                icon: '🎉',
                title: 'HEDEF TAMAMLANDI!',
                message: `TEBRİKLER! %${this.settings.targetGrowth} Büyüme Hedefinize Ulaştınız (${this.formatCurrency(netProfit)}). Yeni hedefinizi belirleyin veya kârınızı çekin.`
            };
        }

        // Strategy Deviation Warnings (for win/be trades)
        if ((trade.result === 'win' || trade.result === 'be') && trade.breakdown) {
            const deviationWarnings = this.analyzeStrategyDeviation(
                trade.breakdown.firstCloseRRR,
                trade.breakdown.firstClosePercent
            );

            if (deviationWarnings.length > 0) {
                return deviationWarnings[0]; // Return first warning
            }
        }

        // Big Runner Caught
        if (trade.result === 'win' && trade.breakdown && trade.breakdown.runnerCloseRRR >= 4.0) {
            const lossesCompensated = Math.floor(trade.profitLoss / this.getFixedRiskAmount());
            return {
                type: 'success',
                icon: '🚀',
                title: 'SÜPER RUNNER!',
                message: `HARIKA! Bu ${trade.breakdown.runnerCloseRRR.toFixed(1)}R koşucu, ${lossesCompensated} adet kaybın maliyetini tek başına çıkardı. Hedefinize büyük bir adım attınız! (+${this.formatCurrency(trade.profitLoss)})`
            };
        }

        // Consecutive Losses
        if (consecutiveLosses >= 3) {
            return {
                type: 'warning',
                icon: '⚠️',
                title: 'DİSİPLİNİ SÜRDÜRÜN',
                message: `${consecutiveLosses} ardışık kayıp yaşadınız. Runner Modelinin doğasında kayıp serileri vardır. Risk kuralınızı değiştirmeden en yüksek olasılıklı kurulumunuzu bekleyin. Sabır anahtardır.`
            };
        }

        // Too Many BE/Low RRR
        if (beCount >= 3 && this.getAverageRRR() < 2.5) {
            return {
                type: 'info',
                icon: '💡',
                title: 'RUNNER POTANSİYELİNİ ARTIRIN',
                message: `Risk Yönetimi Mükemmel (${beCount} BE). Ancak Runner potansiyelinizi artırmalısınız (Ort. RRR: ${this.getAverageRRR().toFixed(2)}R). Daha geniş zaman dilimlerinde veya ana trend yönünde işlem aramayı deneyin.`
            };
        }

        // Good Win
        if (trade.result === 'win' && trade.breakdown && trade.breakdown.runnerCloseRRR >= 2.0) {
            return {
                type: 'success',
                icon: '✅',
                title: 'GÜZEL KAZANÇ!',
                message: `${trade.breakdown.runnerCloseRRR.toFixed(1)}R ile güzel bir kazanç elde ettiniz (+${this.formatCurrency(trade.profitLoss)}). Hedefe ${this.formatCurrency(this.getRemainingProfit())} kaldı. Devam edin!`
            };
        }

        // Standard Feedback
        return null;
    }

    // Get Consecutive Losses
    getConsecutiveLosses() {
        let count = 0;
        for (let i = this.trades.length - 1; i >= 0; i--) {
            if (this.trades[i].result === 'loss') {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    // Get Recent BE Count (last 10 trades)
    getRecentBECount() {
        const recentTrades = this.trades.slice(-10);
        return recentTrades.filter(t => t.result === 'be').length;
    }

    // ===================================
    // TRADE MANAGEMENT
    // ===================================

    addTrade(result, firstCloseRRR, firstClosePercent, runnerCloseRRR, notes = '') {
        const calculation = this.calculateTradeResult(result, firstCloseRRR, firstClosePercent, runnerCloseRRR);

        const trade = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            result: result,
            profitLoss: calculation.total,
            breakdown: calculation.breakdown,
            notes: notes,
            balance: this.getCurrentBalance() + calculation.total
        };

        this.trades.push(trade);
        this.saveTrades();

        return trade;
    }

    clearAllTrades() {
        if (confirm('Tüm işlem geçmişini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
            this.trades = [];
            this.saveTrades();
            this.updateDashboard();
            this.renderTradeHistory();
            this.showNotification('İşlem geçmişi temizlendi', 'info');
        }
    }

    // ===================================
    // UI UPDATES
    // ===================================

    updateDashboard() {
        // Target Status
        document.getElementById('targetProfit').textContent = this.formatCurrency(this.getTargetProfit());
        document.getElementById('currentProfit').textContent = this.formatCurrency(this.getNetProfit());
        document.getElementById('remainingProfit').textContent = this.formatCurrency(this.getRemainingProfit());

        // Progress
        const progress = this.getProgressPercentage();
        document.getElementById('progressPercentage').textContent = `${progress.toFixed(1)}%`;
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressGlow').style.width = `${progress}%`;

        // Profit Change
        const netProfit = this.getNetProfit();
        const profitChangeEl = document.getElementById('profitChange');
        if (netProfit > 0) {
            profitChangeEl.textContent = `+${this.formatCurrency(netProfit)} kazanç`;
            profitChangeEl.className = 'card-sublabel text-success';
        } else if (netProfit < 0) {
            profitChangeEl.textContent = `${this.formatCurrency(netProfit)} kayıp`;
            profitChangeEl.className = 'card-sublabel text-danger';
        } else {
            profitChangeEl.textContent = 'Başlangıç';
            profitChangeEl.className = 'card-sublabel';
        }

        // Remaining Trades Estimate
        const estimatedTrades = this.getEstimatedTradesNeeded();
        document.getElementById('remainingTrades').textContent =
            estimatedTrades > 0 ? `~${estimatedTrades} işlem gerekli` : 'Hedef tamamlandı!';

        // Target Badge
        const targetBadge = document.getElementById('targetBadge');
        if (progress >= 100) {
            targetBadge.textContent = 'Tamamlandı ✓';
            targetBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            targetBadge.style.borderColor = 'var(--accent-success)';
            targetBadge.style.color = 'var(--accent-success)';
        } else {
            targetBadge.textContent = 'Aktif';
            targetBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            targetBadge.style.borderColor = 'var(--accent-success)';
            targetBadge.style.color = 'var(--accent-success)';
        }

        // Metrics
        document.getElementById('currentBalance').textContent = this.formatCurrency(this.getCurrentBalance());

        const winRate = this.getWinRate();
        document.getElementById('winRate').textContent = `${winRate.toFixed(1)}%`;

        const wins = this.trades.filter(t => t.result === 'win').length;
        document.getElementById('winRateDetail').textContent = `${wins}/${this.trades.length} işlem`;

        const avgRRR = this.getAverageRRR();
        document.getElementById('avgRRR').textContent = `${avgRRR.toFixed(2)}R`;
        document.getElementById('rrrDetail').textContent = `${wins} kazanan işlem`;

        document.getElementById('netProfitLoss').textContent = this.formatCurrency(netProfit);
        const profitDetailEl = document.getElementById('profitDetail');
        profitDetailEl.textContent = `${this.trades.length} toplam işlem`;
        if (netProfit > 0) {
            profitDetailEl.parentElement.querySelector('.metric-value').classList.add('positive');
            profitDetailEl.parentElement.querySelector('.metric-value').classList.remove('negative');
        } else if (netProfit < 0) {
            profitDetailEl.parentElement.querySelector('.metric-value').classList.add('negative');
            profitDetailEl.parentElement.querySelector('.metric-value').classList.remove('positive');
        }

        // Max Drawdown
        const maxDD = this.calculateMaxDrawdown();
        document.getElementById('maxDrawdown').textContent = `-${maxDD.toFixed(2)}%`;

        // Update Chart
        this.updateChart();
    }

    showFeedback(feedback) {
        if (!feedback) {
            document.getElementById('feedbackSection').style.display = 'none';
            return;
        }

        const section = document.getElementById('feedbackSection');
        const card = document.getElementById('feedbackCard');
        const icon = document.getElementById('feedbackIcon');
        const title = document.getElementById('feedbackTitle');
        const message = document.getElementById('feedbackMessage');

        // Reset classes
        card.className = 'feedback-card';
        card.classList.add(feedback.type);

        icon.textContent = feedback.icon;
        title.textContent = feedback.title;
        message.textContent = feedback.message;

        section.style.display = 'block';

        // Auto-hide after 15 seconds
        setTimeout(() => {
            section.style.display = 'none';
        }, 15000);
    }

    renderTradeHistory() {
        const container = document.getElementById('historyContainer');
        const paginationContainer = document.getElementById('paginationContainer');

        if (this.trades.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>Henüz işlem kaydı yok</p>
                    <small>Yukarıdaki formdan ilk işleminizi ekleyin</small>
                </div>
            `;
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';

        // Sort to show newest first
        const sortedTrades = [...this.trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Pagination Logic
        const totalPages = Math.ceil(sortedTrades.length / this.itemsPerPage);

        // Ensure current page is valid
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageTrades = sortedTrades.slice(start, end);

        // Update Pagination Controls
        document.getElementById('paginationInfo').textContent = `Sayfa ${this.currentPage} / ${totalPages}`;
        document.getElementById('prevPageBtn').disabled = this.currentPage === 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage === totalPages;

        container.innerHTML = pageTrades.map((trade, index) => {
            // Calculate actual trade number (newest first logic)
            // If we have 10 trades, index 0 on page 1 is trade #10
            // index 0 on page 2 (start=5) is trade #5
            const tradeNumber = sortedTrades.length - (start + index);

            const resultText = {
                'win': '✅ Kazanç',
                'loss': '❌ Kayıp',
                'be': '⚖️ Başa Baş'
            }[trade.result];

            const resultClass = trade.result;
            const profitClass = trade.profitLoss > 0 ? 'positive' : trade.profitLoss < 0 ? 'negative' : '';

            // Strategy compliance badge
            let strategyBadge = '';
            if ((trade.result === 'win' || trade.result === 'be') && trade.breakdown) {
                const rrrDiff = Math.abs((trade.breakdown.firstCloseRRR || 0) - this.settings.rLevel);
                const percentDiff = Math.abs((trade.breakdown.firstClosePercent || 0) - this.settings.lockPercentage);

                if (rrrDiff <= 0.1 && percentDiff <= 5) {
                    strategyBadge = '<span class="strategy-badge compliant">✅ Strateji Uyumlu</span>';
                } else {
                    strategyBadge = '<span class="strategy-badge deviated">⚠️ Sapma Var</span>';
                }
            }

            // Detailed breakdown
            let breakdownHTML = '';
            if (trade.result === 'win' && trade.breakdown) {
                breakdownHTML = `
                    <div class="trade-breakdown">
                        <div class="breakdown-title">💰 Kar Dağılımı:</div>
                        <div class="breakdown-item">
                            <span>İlk Kapanış (${trade.breakdown.firstCloseRRR.toFixed(1)}R @ %${trade.breakdown.firstClosePercent}):</span>
                            <span class="positive">+${this.formatCurrency(trade.breakdown.firstClose)}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Runner Kısmı (${trade.breakdown.runnerCloseRRR.toFixed(1)}R @ %${trade.breakdown.runnerPercent.toFixed(0)}):</span>
                            <span class="positive">+${this.formatCurrency(trade.breakdown.runnerClose)}</span>
                        </div>
                        <div class="breakdown-total">
                            <span>Toplam Kar:</span>
                            <span class="positive">+${this.formatCurrency(trade.profitLoss)}</span>
                        </div>
                    </div>
                `;
            } else if (trade.result === 'be' && trade.breakdown) {
                breakdownHTML = `
                    <div class="trade-breakdown">
                        <div class="breakdown-title">⚖️ Kısmi Kazanç + BE:</div>
                        <div class="breakdown-item">
                            <span>İlk Kapanış (${trade.breakdown.firstCloseRRR.toFixed(1)}R @ %${trade.breakdown.firstClosePercent}):</span>
                            <span class="positive">+${this.formatCurrency(trade.breakdown.firstClose)}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Runner (Giriş Seviyesi):</span>
                            <span>${this.formatCurrency(trade.breakdown.runnerClose)}</span>
                        </div>
                        <div class="breakdown-total">
                            <span>Net Sonuç:</span>
                            <span class="positive">+${this.formatCurrency(trade.profitLoss)}</span>
                        </div>
                    </div>
                `;
            } else if (trade.result === 'loss') {
                breakdownHTML = `
                    <div class="trade-breakdown">
                        <div class="breakdown-title">❌ Kayıp:</div>
                        <div class="breakdown-item">
                            <span>Stop Loss:</span>
                            <span class="negative">${this.formatCurrency(trade.profitLoss)}</span>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="trade-item">
                    <div class="trade-header">
                        <span class="trade-number">İşlem #${tradeNumber}</span>
                        <div class="trade-badges">
                            <span class="trade-result-badge ${resultClass}">${resultText}</span>
                            ${strategyBadge}
                        </div>
                    </div>
                    <div class="trade-details">
                        <div class="trade-detail-item">
                            <span class="trade-detail-label">Tarih</span>
                            <span class="trade-detail-value">${this.formatDate(trade.timestamp)}</span>
                        </div>
                        <div class="trade-detail-item">
                            <span class="trade-detail-label">Nihai Bakiye</span>
                            <span class="trade-detail-value">${this.formatCurrency(trade.balance)}</span>
                        </div>
                    </div>
                    ${breakdownHTML}
                    ${trade.notes ? `<div class="trade-notes">📝 ${trade.notes}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    changePage(direction) {
        this.currentPage += direction;
        this.renderTradeHistory();
    }

    // ===================================
    // EVENT LISTENERS
    // ===================================

    setupEventListeners() {
        // Settings Modal
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('modalOverlay').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // Settings Form
        document.getElementById('settingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettingsFromForm();
        });

        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });

        document.getElementById('clearAllData').addEventListener('click', () => {
            console.log('Clear All Data button clicked');
            this.performFullReset();
        });

        // Trade Form
        document.getElementById('tradeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitTrade();
        });

        document.getElementById('tradeResult').addEventListener('change', (e) => {
            this.toggleTradeInputs(e.target.value);
        });

        // Clear History
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            this.clearAllTrades();
        });

        // Pagination
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            this.changePage(-1);
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            this.changePage(1);
        });
    }

    toggleTradeInputs(result) {
        // Hide all conditional inputs
        document.getElementById('firstCloseRRRGroup').style.display = 'none';
        document.getElementById('firstClosePercentGroup').style.display = 'none';
        document.getElementById('runnerCloseRRRGroup').style.display = 'none';
        document.getElementById('beCloseRRRGroup').style.display = 'none';
        document.getElementById('beClosePercentGroup').style.display = 'none';

        // Clear required attributes
        document.getElementById('firstCloseRRR').required = false;
        document.getElementById('firstClosePercent').required = false;
        document.getElementById('runnerCloseRRR').required = false;
        document.getElementById('beCloseRRR').required = false;
        document.getElementById('beClosePercent').required = false;

        // Show relevant inputs based on result
        if (result === 'win') {
            document.getElementById('firstCloseRRRGroup').style.display = 'flex';
            document.getElementById('firstClosePercentGroup').style.display = 'flex';
            document.getElementById('runnerCloseRRRGroup').style.display = 'flex';

            document.getElementById('firstCloseRRR').required = true;
            document.getElementById('firstClosePercent').required = true;
            document.getElementById('runnerCloseRRR').required = true;
        } else if (result === 'be') {
            document.getElementById('beCloseRRRGroup').style.display = 'flex';
            document.getElementById('beClosePercentGroup').style.display = 'flex';

            document.getElementById('beCloseRRR').required = true;
            document.getElementById('beClosePercent').required = true;
        }
    }

    submitTrade() {
        const result = document.getElementById('tradeResult').value;
        const notes = document.getElementById('tradeNotes').value.trim();

        // Validation
        if (!result) {
            alert('Lütfen işlem sonucunu seçin');
            return;
        }

        let firstCloseRRR = 0;
        let firstClosePercent = 0;
        let runnerCloseRRR = 0;

        if (result === 'win') {
            firstCloseRRR = parseFloat(document.getElementById('firstCloseRRR').value);
            firstClosePercent = parseFloat(document.getElementById('firstClosePercent').value);
            runnerCloseRRR = parseFloat(document.getElementById('runnerCloseRRR').value);

            if (!firstCloseRRR || !firstClosePercent || !runnerCloseRRR) {
                alert('Lütfen tüm kazanç bilgilerini girin');
                return;
            }

            if (firstClosePercent < 0 || firstClosePercent > 100) {
                alert('Kapanış yüzdesi 0-100 arasında olmalıdır');
                return;
            }
        } else if (result === 'be') {
            firstCloseRRR = parseFloat(document.getElementById('beCloseRRR').value);
            firstClosePercent = parseFloat(document.getElementById('beClosePercent').value);

            if (!firstCloseRRR || !firstClosePercent) {
                alert('Lütfen BE işlem bilgilerini girin');
                return;
            }

            if (firstClosePercent < 0 || firstClosePercent > 100) {
                alert('Kapanış yüzdesi 0-100 arasında olmalıdır');
                return;
            }
        }

        // Add Trade
        const trade = this.addTrade(result, firstCloseRRR, firstClosePercent, runnerCloseRRR, notes);

        // Update UI
        this.updateDashboard();
        this.renderTradeHistory();

        // Show Feedback
        const feedback = this.generateFeedback(trade);
        this.showFeedback(feedback);

        // Reset Form
        document.getElementById('tradeForm').reset();
        this.toggleTradeInputs('');

        // Scroll to feedback if exists
        if (feedback) {
            document.getElementById('feedbackSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    openSettingsModal() {
        // Populate form with current settings
        document.getElementById('initialCapital').value = this.settings.initialCapital;
        document.getElementById('targetGrowth').value = this.settings.targetGrowth;
        document.getElementById('riskPerTrade').value = this.settings.riskPerTrade;
        document.getElementById('rLevel').value = this.settings.rLevel;
        document.getElementById('lockPercentage').value = this.settings.lockPercentage;

        document.getElementById('settingsModal').classList.add('active');
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    saveSettingsFromForm() {
        const newSettings = {
            initialCapital: parseFloat(document.getElementById('initialCapital').value),
            targetGrowth: parseFloat(document.getElementById('targetGrowth').value),
            riskPerTrade: parseFloat(document.getElementById('riskPerTrade').value),
            rLevel: parseFloat(document.getElementById('rLevel').value),
            lockPercentage: parseFloat(document.getElementById('lockPercentage').value)
        };

        // Validation
        if (newSettings.initialCapital < 1000) {
            alert('Başlangıç sermayesi en az 1,000 TL olmalıdır');
            return;
        }

        if (newSettings.targetGrowth < 1 || newSettings.targetGrowth > 100) {
            alert('Hedef büyüme oranı 1-100 arasında olmalıdır');
            return;
        }

        if (newSettings.riskPerTrade < 0.1 || newSettings.riskPerTrade > 5) {
            alert('Risk oranı 0.1-5 arasında olmalıdır');
            return;
        }

        // Check if initial capital changed
        if (newSettings.initialCapital !== this.settings.initialCapital && this.trades.length > 0) {
            if (!confirm('Başlangıç sermayesini değiştirmek mevcut işlem geçmişinizi etkileyebilir. Devam etmek istiyor musunuz?')) {
                return;
            }
        }

        this.settings = newSettings;
        this.saveSettings();
        this.updateDashboard();
        this.closeSettingsModal();
        alert('✅ Ayarlar başarıyla kaydedildi');
    }

    resetSettings() {
        if (confirm('Tüm ayarları varsayılan değerlere döndürmek istiyor musunuz?')) {
            this.settings = this.getDefaultSettings();
            this.saveSettings();

            // Refresh form values
            document.getElementById('initialCapital').value = this.settings.initialCapital;
            document.getElementById('targetGrowth').value = this.settings.targetGrowth;
            document.getElementById('riskPerTrade').value = this.settings.riskPerTrade;
            document.getElementById('rLevel').value = this.settings.rLevel;
            document.getElementById('lockPercentage').value = this.settings.lockPercentage;

            this.updateDashboard();
            alert('✅ Ayarlar varsayılan değerlere döndürüldü');
        }
    }

    performFullReset() {
        const btn = document.getElementById('clearAllData');

        // Check if already in confirmation state
        if (btn.innerText !== '⚠️ Emin misin?') {
            // First click: Ask for confirmation
            const originalText = btn.innerText;
            btn.innerText = '⚠️ Emin misin?';

            // Reset button text after 3 seconds if not clicked again
            setTimeout(() => {
                if (document.getElementById('clearAllData')) { // Check if element still exists
                    btn.innerText = originalText;
                }
            }, 3000);
            return;
        }

        // Second click: Perform reset
        console.log('Performing full reset...');

        // Reset Settings
        this.settings = this.getDefaultSettings();
        this.saveSettings();

        // Clear Trades
        this.trades = [];
        this.saveTrades();

        // Refresh form values
        document.getElementById('initialCapital').value = this.settings.initialCapital;
        document.getElementById('targetGrowth').value = this.settings.targetGrowth;
        document.getElementById('riskPerTrade').value = this.settings.riskPerTrade;
        document.getElementById('rLevel').value = this.settings.rLevel;
        document.getElementById('lockPercentage').value = this.settings.lockPercentage;

        // Update UI
        this.updateDashboard();
        this.renderTradeHistory();
        this.closeSettingsModal();

        // Reset button text
        btn.innerText = 'Tüm Verileri Sıfırla';

        alert('✅ Sistem başarıyla sıfırlandı!');
    }

    // ===================================
    // UTILITY FUNCTIONS
    // ===================================

    formatCurrency(amount) {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// ===================================
// INITIALIZE APPLICATION
// ===================================
let tradingSystem;

document.addEventListener('DOMContentLoaded', () => {
    tradingSystem = new TradingSystem();
    console.log('🚀 Runner R-Performance Tracker V2.0 initialized successfully!');
});
