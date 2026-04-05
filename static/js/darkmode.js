// Dark mode toggle with auto-detect
(function() {
    'use strict';

    function getPreference() {
        return localStorage.getItem('theme') || 'auto';
    }

    function resolveTheme(pref) {
        if (pref === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return pref;
    }

    function applyTheme(pref) {
        var resolved = resolveTheme(pref);
        document.documentElement.setAttribute('data-theme', resolved);
        localStorage.setItem('theme', pref);
        updateUI(pref);
    }

    function updateUI(pref) {
        var btn = document.getElementById('theme-toggle');
        if (btn) {
            var icons = btn.querySelectorAll('.theme-icon');
            for (var i = 0; i < icons.length; i++) {
                icons[i].style.display = 'none';
            }
            var active = btn.querySelector('.theme-icon--' + pref);
            if (active) active.style.display = 'inline-block';
        }
        // Mark active item
        var items = document.querySelectorAll('[data-theme-choice]');
        for (var i = 0; i < items.length; i++) {
            items[i].classList.toggle('theme-menu__active', items[i].getAttribute('data-theme-choice') === pref);
        }
    }

    // Apply saved theme immediately to prevent flash
    var saved = getPreference();
    var resolved = resolveTheme(saved);
    if (resolved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.addEventListener('DOMContentLoaded', function() {
        applyTheme(getPreference());

        var toggle = document.getElementById('theme-toggle');
        var menu = document.getElementById('theme-menu');
        if (!toggle || !menu) return;

        // Toggle dropdown
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('theme-menu--open');
            if (!isOpen) {
                var rect = toggle.getBoundingClientRect();
                menu.style.top = rect.bottom + 'px';
                menu.style.right = (window.innerWidth - rect.right) + 'px';
                menu.classList.add('theme-menu--open');
                toggle.setAttribute('aria-expanded', 'true');
            } else {
                menu.classList.remove('theme-menu--open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Handle choice
        menu.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-theme-choice]');
            if (btn) {
                applyTheme(btn.getAttribute('data-theme-choice'));
                menu.classList.remove('theme-menu--open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on outside click
        document.addEventListener('click', function() {
            menu.classList.remove('theme-menu--open');
            toggle.setAttribute('aria-expanded', 'false');
        });

        // Listen for OS theme changes when set to auto
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
            if (getPreference() === 'auto') {
                applyTheme('auto');
            }
        });
    });
})();
