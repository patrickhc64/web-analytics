class AdvancedAnalytics {
    constructor() {
        this.clicks = JSON.parse(localStorage.getItem('analyticsClicks')) || [];
        this.sessions = JSON.parse(localStorage.getItem('analyticsSessions')) || {};
        this.currentSession = this.getSessionId();
        this.userId = this.getUserId();
        this.scrollRecorded = false;
        this.gaEventsSent = 0;
        this.gaConfig = JSON.parse(localStorage.getItem('gaConfig')) || {
            measurementId: '',
            apiSecret: '',
            enabled: false
        };
        this.init();
    }

    init() {
        this.setupListeners();
        this.recordPageView();
        this.updateCopyrightYear();
        this.updateGAStatus();
    }

    getSessionId() {
        const sessionId = localStorage.getItem('currentSession');
        if (sessionId) return sessionId;
        
        const newSessionId = 'session-' + Date.now();
        localStorage.setItem('currentSession', newSessionId);
        return newSessionId;
    }

    getUserId() {
        let userId = localStorage.getItem('analyticsUserId');
        if (!userId) {
            userId = 'user-' + Math.floor(Math.random() * 1000000);
            localStorage.setItem('analyticsUserId', userId);
        }
        return userId;
    }

    setupListeners() {
        // jQuery event handlers
        $(document).on('click', (e) => this.recordClick(e));
        $(window).on('scroll', () => this.recordScroll());
        $(window).on('resize', () => this.recordResize());
        $('#generate-report').on('click', () => this.generateReport());
        $('#toggle-heatmap').on('click', () => this.toggleHeatmap());
        $('.nav-link').on('click', (e) => this.handleNavigation(e));
        $('#feedback-form').on('submit', (e) => this.handleFormSubmit(e));
        $('#date-range').on('change', () => this.generateReport());
        
        // GA Config
        $('#save-ga-config').on('click', () => this.saveGAConfig());
        $('#clear-log').on('click', () => $('#ga-event-log').empty());
    }

    saveGAConfig() {
        this.gaConfig = {
            measurementId: $('#ga-measurement-id').val(),
            apiSecret: $('#ga-api-secret').val(),
            enabled: true
        };
        localStorage.setItem('gaConfig', JSON.stringify(this.gaConfig));
        this.logGAEvent('Config saved');
        alert('Google Analytics configuration saved!');
    }

    updateGAStatus() {
        if (this.gaConfig.enabled) {
            $('#ga-measurement-id').val(this.gaConfig.measurementId);
            $('#ga-api-secret').val(this.gaConfig.apiSecret);
        }
        $('#ga-events').text(this.gaEventsSent);
    }

    logGAEvent(message, eventData = {}) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `<div class="log-entry">
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
            <pre class="event-data">${JSON.stringify(eventData, null, 2)}</pre>
        </div>`;
        $('#ga-event-log').prepend(logEntry);
    }

    sendToGA(eventName, params = {}) {
        if (!this.gaConfig.enabled || !this.gaConfig.measurementId || !this.gaConfig.apiSecret) {
            this.logGAEvent(`GA not configured - event not sent: ${eventName}`, params);
            return;
        }

        const payload = {
            client_id: this.userId,
            events: [{
                name: eventName,
                params: {
                    session_id: this.currentSession,
                    page_location: window.location.href,
                    ...params
                }
            }]
        };

        // Use Measurement Protocol API
        fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${this.gaConfig.measurementId}&api_secret=${this.gaConfig.apiSecret}`,
            {
                method: 'POST',
                body: JSON.stringify(payload)
            }
        )
        .then(response => {
            if (response.ok) {
                this.gaEventsSent++;
                $('#ga-events').text(this.gaEventsSent);
                this.logGAEvent(`GA event sent: ${eventName}`, payload);
            } else {
                response.text().then(text => {
                    this.logGAEvent(`GA error: ${response.status} - ${text}`, payload);
                });
            }
        })
        .catch(error => {
            this.logGAEvent(`GA network error: ${error.message}`, payload);
        });
    }

    recordPageView() {
        const pageData = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer,
            sessionId: this.currentSession,
            userId: this.userId,
            device: this.getDeviceType()
        };

        // Save locally
        if (!this.sessions[this.currentSession]) {
            this.sessions[this.currentSession] = {
                startTime: new Date().toISOString(),
                pageViews: [pageData],
                events: []
            };
        } else {
            this.sessions[this.currentSession].pageViews.push(pageData);
        }
        
        localStorage.setItem('analyticsSessions', JSON.stringify(this.sessions));
        
        // Send to GA
        this.sendToGA('page_view', {
            page_title: document.title,
            page_location: window.location.href,
            page_referrer: document.referrer
        });
    }

    recordClick(event) {
        const target = $(event.target);
        const clickData = {
            type: 'click',
            timestamp: new Date().toISOString(),
            position: { x: event.clientX, y: event.clientY },
            element: target.prop('tagName'),
            id: target.attr('id') || '',
            classes: target.attr('class') || '',
            text: target.text().trim().substring(0, 50),
            url: window.location.href,
            sessionId: this.currentSession,
            userId: this.userId
        };

        this.clicks.push(clickData);
        localStorage.setItem('analyticsClicks', JSON.stringify(this.clicks));
        this.sessions[this.currentSession].events.push(clickData);
        localStorage.setItem('analyticsSessions', JSON.stringify(this.sessions));
        
        // Send to GA
        this.sendToGA('click', {
            element: clickData.element,
            element_id: clickData.id,
            element_classes: clickData.classes,
            page_path: window.location.pathname
        });
    }

    recordScroll() {
        const scrollPosition = $(window).scrollTop();
        const windowHeight = $(window).height();
        const docHeight = $(document).height();
        const scrollPercent = Math.round((scrollPosition / (docHeight - windowHeight)) * 100);
        
        if (scrollPercent > 70 && !this.scrollRecorded) {
            this.scrollRecorded = true;
            
            const scrollData = {
                type: 'scroll',
                timestamp: new Date().toISOString(),
                position: scrollPercent,
                url: window.location.href,
                sessionId: this.currentSession,
                userId: this.userId
            };
            
            this.sessions[this.currentSession].events.push(scrollData);
            localStorage.setItem('analyticsSessions', JSON.stringify(this.sessions));
            
            // Send to GA
            this.sendToGA('scroll', {
                scroll_depth: scrollPercent + '%'
            });
        }
    }

    handleNavigation(e) {
        e.preventDefault();
        const targetPage = $(e.target).data('page');
        
        // Handle navigation
        $('.page-section').hide();
        $(`#${targetPage}`).show();
        
        // Update URL without reloading
        history.pushState(null, null, `#${targetPage}`);
        
        // Send to GA
        this.sendToGA('navigation', {
            menu_item: targetPage
        });
    }

    handleFormSubmit(e) {
        e.preventDefault();
        const formData = {
            name: $('#name').val(),
            email: $('#email').val(),
            message: $('#message').val()
        };
        
        // Record conversion
        const conversionData = {
            type: 'conversion',
            timestamp: new Date().toISOString(),
            form: 'feedback-form',
            sessionId: this.currentSession,
            userId: this.userId
        };
        
        this.sessions[this.currentSession].events.push(conversionData);
        localStorage.setItem('analyticsSessions', JSON.stringify(this.sessions));
        
        // Send to GA
        this.sendToGA('form_submit', {
            form_id: 'feedback-form',
            form_name: 'User Feedback'
        });
        
        // Show confirmation
        $('#feedback-form').html(
            '<div class="success-message">Thank you for your feedback!</div>'
        );
        
        // Reset form after 3 seconds
        setTimeout(() => {
            $('#feedback-form')[0].reset();
            $('#feedback-form').html(`
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name">
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email">
                </div>
                <div class="form-group">
                    <label for="message">Message:</label>
                    <textarea id="message" name="message" rows="4"></textarea>
                </div>
                <button type="submit">Submit Feedback</button>
            `);
        }, 3000);
    }

    generateReport() {
        const dateRange = $('#date-range').val();
        const filteredClicks = this.filterByDate(dateRange);
        
        const report = {
            totalClicks: filteredClicks.length,
            uniqueVisitors: this.getUniqueVisitors(dateRange),
            pages: {},
            elements: {},
            sessions: Object.keys(this.sessions).length,
            conversions: this.getConversions(dateRange),
            gaEvents: this.gaEventsSent
        };
        
        filteredClicks.forEach(click => {
            report.pages[click.url] = (report.pages[click.url] || 0) + 1;
            const elementKey = click.element + (click.id ? `#${click.id}` : '');
            report.elements[elementKey] = (report.elements[elementKey] || 0) + 1;
        });
        
        this.displayReport(report);
        this.displayCharts(filteredClicks);
        this.updateMetrics(report);
    }

    displayReport(report) {
        let reportHTML = `
            <h3>Analytics Report</h3>
            <div class="report-summary">
                <p><strong>Total Interactions:</strong> ${report.totalClicks}</p>
                <p><strong>Unique Visitors:</strong> ${report.uniqueVisitors}</p>
                <p><strong>Sessions:</strong> ${report.sessions}</p>
                <p><strong>Conversions:</strong> ${report.conversions}</p>
                <p><strong>GA Events Sent:</strong> ${report.gaEvents}</p>
            </div>
            <div class="report-details">
                <div class="report-column">
                    <h4>By Page</h4>
                    <ul>`;
        
        for (const [page, count] of Object.entries(report.pages)) {
            reportHTML += `<li>${page}: <span class="count">${count}</span></li>`;
        }
        
        reportHTML += `</ul></div><div class="report-column"><h4>By Element</h4><ul>`;
        
        for (const [element, count] of Object.entries(report.elements)) {
            reportHTML += `<li>${element}: <span class="count">${count}</span></li>`;
        }
        
        reportHTML += `</ul></div></div>`;
        
        $('#analytics-report').html(reportHTML);
    }

    displayCharts(clicks) {
        // Time-based click distribution
        const hourlyData = Array(24).fill(0);
        clicks.forEach(click => {
            const hour = new Date(click.timestamp).getHours();
            hourlyData[hour]++;
        });
        
        const ctx = document.getElementById('clicks-chart').getContext('2d');
        
        // Destroy previous chart if exists
        if (window.clicksChart) {
            window.clicksChart.destroy();
        }
        
        window.clicksChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Clicks by Hour',
                    data: hourlyData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Clicks'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    }
                }
            }
        });
    }

    toggleHeatmap() {
        const heatmap = $('#heatmap-container');
        const button = $('#toggle-heatmap');
        
        if (heatmap.is(':visible')) {
            heatmap.hide();
            button.text('Show Heatmap');
        } else {
            heatmap.empty().show();
            button.text('Hide Heatmap');
            
            this.clicks.forEach(click => {
                $('<div>')
                    .addClass('heatmap-point')
                    .css({
                        left: `${click.position.x}px`,
                        top: `${click.position.y}px`
                    })
                    .appendTo(heatmap);
            });
        }
    }

    updateCopyrightYear() {
        $('#current-year').text(new Date().getFullYear());
    }

    // Helper methods
    getDeviceType() {
        return window.innerWidth < 768 ? 'mobile' : 
               window.innerWidth < 1024 ? 'tablet' : 'desktop';
    }

    filterByDate(range) {
        const now = new Date();
        return this.clicks.filter(click => {
            const clickDate = new Date(click.timestamp);
            
            switch(range) {
                case 'today':
                    return clickDate.toDateString() === now.toDateString();
                case 'week':
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay());
                    return clickDate >= startOfWeek;
                case 'month':
                    return clickDate.getMonth() === now.getMonth() && 
                           clickDate.getFullYear() === now.getFullYear();
                default:
                    return true;
            }
        });
    }

    getUniqueVisitors(range) {
        const users = new Set();
        Object.values(this.sessions).forEach(session => {
            if (this.isInRange(session.startTime, range)) {
                users.add(session.userId);
            }
        });
        return users.size;
    }

    getConversions(range) {
        return Object.values(this.sessions).filter(session => {
            return session.events.some(event => 
                event.type === 'conversion' && 
                this.isInRange(event.timestamp, range)
            );
        }).length;
    }

    isInRange(timestamp, range) {
        const date = new Date(timestamp);
        const now = new Date();
        
        switch(range) {
            case 'today':
                return date.toDateString() === now.toDateString();
            case 'week':
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                return date >= startOfWeek;
            case 'month':
                return date.getMonth() === now.getMonth() && 
                       date.getFullYear() === now.getFullYear();
            default:
                return true;
        }
    }

    updateMetrics(report) {
        $('#total-clicks').text(report.totalClicks);
        $('#unique-visitors').text(report.uniqueVisitors);
        
        const conversionRate = report.sessions ? 
            Math.round((report.conversions / report.sessions) * 100) : 0;
        $('#conversion-rate').text(conversionRate + '%');
    }
}

// Initialize analytics
$(document).ready(() => {
    window.analyticsTracker = new AdvancedAnalytics();
    
    // Show home page by default
    const hash = window.location.hash.substring(1) || 'home';
    $(`#${hash}`).show();
    
    // Set navigation active state
    $(`.nav-link[data-page="${hash}"]`).addClass('active');
    
    // Navigation click handler
    $('.nav-link').click(function(e) {
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        const target = $(this).data('page');
        $('.page-section').hide();
        $(`#${target}`).show();
        window.location.hash = target;
    });
});