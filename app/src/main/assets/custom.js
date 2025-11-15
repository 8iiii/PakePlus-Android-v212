// ==UserScript==
// @name         叔叔不约只配女-手机增强版
// @namespace    yeyu
// @version      1.4
// @description  叔叔不约只配女，深度适配手机端，不依赖GM API
// @author       夜雨
// @match        *://*.shushubuyue.net/*
// @match        *://*.shushubuyue.com/*
// @match        *://*.shushubuyue.cn/*
// @match        *://*.shushubuyue.top/*
// @match        *://*.shushubuyue.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shushubuyue.net
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 配置存储键名
    const CONFIG_KEY = 'shushubuyue_config';
    
    // 默认配置
    const defaultConfig = {
        enabled: true,
        contactInfo: '',
        greeting1: '你好|很高兴认识你|我们可以聊聊吗',
        greeting2: '嗨|今天过得怎么样|想交个朋友吗'
    };

    // 获取配置 - 使用 localStorage
    function getConfig() {
        try {
            const saved = localStorage.getItem(CONFIG_KEY);
            return saved ? {...defaultConfig, ...JSON.parse(saved)} : defaultConfig;
        } catch (e) {
            console.error('读取配置失败:', e);
            return defaultConfig;
        }
    }

    // 保存配置 - 使用 localStorage
    function saveConfig(config) {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            return true;
        } catch (e) {
            console.error('保存配置失败:', e);
            return false;
        }
    }

    // 全局变量
    let config = getConfig();
    let isScriptRunning = config.enabled;
    let firstAuto = true;
    let contactChunks = [];
    let currentChunkIndex = 0;
    let mainInterval = null;

    // 检测移动设备
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768 || 'ontouchstart' in window;
    }

    // 创建浮动控制按钮
    function createControlButton() {
        // 移除已存在的按钮
        const existingBtn = document.getElementById('ssby-control-btn');
        if (existingBtn) existingBtn.remove();
        
        const btn = document.createElement('div');
        btn.id = 'ssby-control-btn';
        btn.innerHTML = '▶';
        
        // 移动端和PC端不同的样式
        const isMobile = isMobileDevice();
        const btnSize = isMobile ? '60px' : '50px';
        const fontSize = isMobile ? '24px' : '20px';
        
        btn.style.cssText = `
            position: fixed;
            top: ${isMobile ? '10px' : '20px'};
            right: ${isMobile ? '10px' : '20px'};
            width: ${btnSize};
            height: ${btnSize};
            background: rgba(255, 0, 0, 0.7);
            clip-path: polygon(0% 0%, 100% 50%, 0% 100%);
            cursor: pointer;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: ${fontSize};
            font-weight: bold;
            transition: all 0.3s ease;
            border-radius: 5px;
            user-select: none;
            touch-action: manipulation;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        // 移动端触摸事件
        let touchTimer;
        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            touchTimer = setTimeout(() => {
                // 长按事件 - 显示配置面板
                showConfigPanel();
                clearTimeout(touchTimer);
            }, 800);
        }, { passive: false });

        btn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(touchTimer);
            // 短按事件 - 切换脚本状态
            toggleScript();
        }, { passive: false });

        // PC端鼠标事件
        let clickTimer;
        btn.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            clickTimer = setTimeout(() => {
                // 长按事件 - 显示配置面板
                showConfigPanel();
                clearTimeout(clickTimer);
            }, 800);
        });

        btn.addEventListener('mouseup', function(e) {
            e.stopPropagation();
            clearTimeout(clickTimer);
            // 短按事件 - 切换脚本状态
            if (e.button === 0) {
                toggleScript();
            }
        });

        // 鼠标移出也清除定时器
        btn.addEventListener('mouseleave', function() {
            clearTimeout(clickTimer);
        });

        document.body.appendChild(btn);
        updateButtonState();
        return btn;
    }

    // 创建发送联系方式按钮
    function createContactButton() {
        // 移除已存在的按钮
        const existingBtn = document.getElementById('ssby-contact-btn');
        if (existingBtn) existingBtn.remove();
        
        const btn = document.createElement('div');
        btn.id = 'ssby-contact-btn';
        btn.innerHTML = '联';
        
        // 移动端和PC端不同的样式
        const isMobile = isMobileDevice();
        const btnSize = isMobile ? '60px' : '50px';
        const fontSize = isMobile ? '24px' : '20px';
        const topPosition = isMobile ? '80px' : '80px';
        
        btn.style.cssText = `
            position: fixed;
            top: ${topPosition};
            right: ${isMobile ? '10px' : '20px'};
            width: ${btnSize};
            height: ${btnSize};
            background: rgba(33, 150, 243, 0.7);
            cursor: pointer;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: ${fontSize};
            font-weight: bold;
            transition: all 0.3s ease;
            border-radius: 50%;
            user-select: none;
            touch-action: manipulation;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        // 移动端触摸事件
        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sendContactInChunks();
        }, { passive: false });

        // PC端鼠标事件
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (e.button === 0) {
                sendContactInChunks();
            }
        });

        document.body.appendChild(btn);
        return btn;
    }

    // 更新按钮状态
    function updateButtonState() {
        const btn = document.getElementById('ssby-control-btn');
        if (btn) {
            if (isScriptRunning) {
                btn.innerHTML = '❚❚';
                btn.style.background = 'rgba(0, 255, 0, 0.7)';
            } else {
                btn.innerHTML = '▶';
                btn.style.background = 'rgba(255, 0, 0, 0.7)';
            }
        }
    }

    // 切换脚本状态
    function toggleScript() {
        isScriptRunning = !isScriptRunning;
        config.enabled = isScriptRunning;
        saveConfig(config);
        updateButtonState();
        
        if (isScriptRunning) {
            firstAuto = true;
            // 如果当前没有匹配到人，尝试重新开始
            restartIfNeeded();
            // 重新启动主循环
            if (!mainInterval) {
                startMainLoop();
            }
        } else {
            // 停止时清理定时器
            if (mainInterval) {
                clearInterval(mainInterval);
                mainInterval = null;
            }
        }
    }

    // 如果需要，重新开始匹配
    function restartIfNeeded() {
        // 尝试多种可能的选择器来检测重新开始按钮
        const elements = document.querySelectorAll('span, button, div, a');
        let restartButton = null;
        
        for (const el of elements) {
            if (el.textContent && el.textContent.trim() === '重新开始') {
                restartButton = el;
                break;
            }
        }
        
        // 如果找到重新开始按钮，则点击
        if (restartButton) {
            try {
                restartButton.click();
                console.log('已点击重新开始按钮');
            } catch (e) {
                console.error('点击重新开始按钮失败:', e);
            }
        }
    }

    // 创建配置面板
    function createConfigPanel() {
        // 移除已存在的面板
        const existingPanel = document.getElementById('ssby-config-panel');
        if (existingPanel) existingPanel.remove();
        
        const panel = document.createElement('div');
        panel.id = 'ssby-config-panel';
        
        // 移动端和PC端不同的样式
        const isMobile = isMobileDevice();
        const panelWidth = isMobile ? '90vw' : '300px';
        const panelTop = isMobile ? '150px' : '140px';
        const panelRight = isMobile ? '5vw' : '20px';
        const fontSize = isMobile ? '16px' : '12px';
        const inputHeight = isMobile ? '80px' : '60px';
        
        panel.style.cssText = `
            position: fixed;
            top: ${panelTop};
            right: ${panelRight};
            width: ${panelWidth};
            max-width: 400px;
            background: rgba(255, 255, 255, 0.98);
            border: 2px solid #ccc;
            border-radius: 10px;
            padding: ${isMobile ? '20px' : '15px'};
            z-index: 10001;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            display: none;
            overflow-y: auto;
            max-height: 80vh;
        `;

        panel.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: ${isMobile ? '18px' : '14px'};">
                叔叔不约配置面板
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-size: ${fontSize};">联系方式 (QQ/微信等):</label>
                <textarea id="ssby-contact" rows="3" style="width: 100%; padding: 8px; font-size: ${fontSize}; border: 1px solid #ccc; border-radius: 5px; height: ${inputHeight};" placeholder="请输入您的联系方式">${config.contactInfo}</textarea>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-size: ${fontSize};">打招呼语句1 (用|分割):</label>
                <textarea id="ssby-greeting1" rows="3" style="width: 100%; padding: 8px; font-size: ${fontSize}; border: 1px solid #ccc; border-radius: 5px; height: ${inputHeight};">${config.greeting1}</textarea>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-size: ${fontSize};">打招呼语句2 (用|分割):</label>
                <textarea id="ssby-greeting2" rows="3" style="width: 100%; padding: 8px; font-size: ${fontSize}; border: 1px solid #ccc; border-radius: 5px; height: ${inputHeight};">${config.greeting2}</textarea>
            </div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button id="ssby-save" style="flex: 1; padding: ${isMobile ? '12px' : '8px'}; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: ${fontSize}; touch-action: manipulation;">保存配置</button>
                <button id="ssby-close" style="flex: 1; padding: ${isMobile ? '12px' : '8px'}; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: ${fontSize}; touch-action: manipulation;">关闭</button>
            </div>
            
            <div style="font-size: ${isMobile ? '14px' : '11px'}; color: #666; text-align: center;">
                点击三角按钮切换启停，长按打开配置
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    // 显示配置面板
    function showConfigPanel() {
        const panel = document.getElementById('ssby-config-panel');
        if (panel) {
            panel.style.display = 'block';
            
            // 添加背景遮罩
            let overlay = document.getElementById('ssby-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'ssby-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 10000;
                `;
                document.body.appendChild(overlay);
                
                // 点击遮罩关闭面板
                overlay.addEventListener('click', hideConfigPanel);
                overlay.addEventListener('touchstart', hideConfigPanel);
            }
        }
    }

    // 隐藏配置面板
    function hideConfigPanel() {
        const panel = document.getElementById('ssby-config-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        
        // 移除背景遮罩
        const overlay = document.getElementById('ssby-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // 保存配置
    function saveConfigFromPanel() {
        const contact = document.getElementById('ssby-contact').value;
        const greeting1 = document.getElementById('ssby-greeting1').value;
        const greeting2 = document.getElementById('ssby-greeting2').value;

        config.contactInfo = contact;
        config.greeting1 = greeting1;
        config.greeting2 = greeting2;

        if (saveConfig(config)) {
            alert('配置已保存！');
        } else {
            alert('保存配置失败，请检查控制台信息');
        }
        hideConfigPanel();
    }

    // 获取随机问候语
    function getRandomGreeting() {
        const greetings1 = config.greeting1.split('|').filter(g => g.trim());
        const greetings2 = config.greeting2.split('|').filter(g => g.trim());
        
        let selectedGreetings = [];
        
        if (greetings1.length > 0 && greetings2.length > 0) {
            selectedGreetings = Math.random() > 0.5 ? greetings1 : greetings2;
        } else if (greetings1.length > 0) {
            selectedGreetings = greetings1;
        } else if (greetings2.length > 0) {
            selectedGreetings = greetings2;
        } else {
            selectedGreetings = ['你好啊'];
        }
        
        return selectedGreetings;
    }

    // 发送消息
    function sendMessage(message) {
        // 尝试多种可能的选择器来找到输入框
        const inputSelectors = [
            "#msgInput",
            "input[type='text']",
            "textarea",
            ".msg-input",
            ".input-box",
            "[contenteditable='true']"
        ];
        
        let msgInput = null;
        for (const selector of inputSelectors) {
            msgInput = document.querySelector(selector);
            if (msgInput) break;
        }
        
        if (msgInput) {
            // 清除输入框内容
            msgInput.value = '';
            msgInput.textContent = '';
            
            // 设置新内容
            if (msgInput.tagName === 'INPUT' || msgInput.tagName === 'TEXTAREA') {
                msgInput.value = message;
            } else {
                msgInput.textContent = message;
            }
            
            // 触发事件
            const event = new Event('input', { bubbles: true });
            msgInput.dispatchEvent(event);
            
            // 尝试多种可能的选择器来找到发送按钮
            const buttonSelectors = [
                ".button-link.msg-send",
                ".msg-send",
                "button[type='submit']",
                ".send-btn",
                "input[type='submit']"
            ];
            
            let sendButton = null;
            for (const selector of buttonSelectors) {
                sendButton = document.querySelector(selector);
                if (sendButton) break;
            }
            
            // 如果通过选择器没找到，尝试通过文本查找
            if (!sendButton) {
                const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
                for (const btn of buttons) {
                    if ((btn.value && btn.value.includes('发送')) || 
                        (btn.textContent && btn.textContent.includes('发送'))) {
                        sendButton = btn;
                        break;
                    }
                }
            }
            
            if (sendButton) {
                try {
                    sendButton.click();
                    return true;
                } catch (e) {
                    console.error('点击发送按钮失败:', e);
                }
            }
        }
        
        return false;
    }

    // 分段发送联系方式
    function sendContactInChunks() {
        if (!config.contactInfo) {
            alert('请先在配置中设置联系方式！');
            return;
        }

        // 将联系方式按3位一组分割
        contactChunks = [];
        const contactStr = config.contactInfo.replace(/\s/g, '');
        for (let i = 0; i < contactStr.length; i += 3) {
            contactChunks.push(contactStr.substring(i, i + 3));
        }
        
        currentChunkIndex = 0;
        sendNextContactChunk();
    }

    // 发送下一个联系方式分段
    function sendNextContactChunk() {
        if (currentChunkIndex < contactChunks.length) {
            const sent = sendMessage(contactChunks[currentChunkIndex]);
            if (sent) {
                currentChunkIndex++;
                // 每隔2秒发送下一段
                setTimeout(sendNextContactChunk, 2000);
            } else {
                // 如果发送失败，稍后重试
                setTimeout(() => sendNextContactChunk(), 1000);
            }
        }
    }

    // 离开聊天
    function leave() {
        // 尝试多种可能的选择器来找到离开按钮
        const leaveSelectors = [
            "a.button-link.chat-control",
            ".chat-control",
            ".leave-btn"
        ];
        
        let leaveButton = null;
        for (const selector of leaveSelectors) {
            leaveButton = document.querySelector(selector);
            if (leaveButton) break;
        }
        
        // 如果通过选择器没找到，尝试通过文本查找
        if (!leaveButton) {
            const elements = document.querySelectorAll('a, button');
            for (const el of elements) {
                if (el.textContent && el.textContent.includes('离开')) {
                    leaveButton = el;
                    break;
                }
            }
        }
        
        if (leaveButton) {
            try {
                leaveButton.click();
                
                // 等待确认对话框出现
                setTimeout(() => {
                    // 尝试找到确认按钮
                    const confirmSelectors = [
                        "span.actions-modal-button.actions-modal-button-bold.color-danger",
                        ".color-danger"
                    ];
                    
                    let confirmButton = null;
                    for (const selector of confirmSelectors) {
                        confirmButton = document.querySelector(selector);
                        if (confirmButton) break;
                    }
                    
                    // 如果通过选择器没找到，尝试通过文本查找
                    if (!confirmButton) {
                        const buttons = document.querySelectorAll('button, span');
                        for (const btn of buttons) {
                            if (btn.textContent && (
                                btn.textContent.includes('确认') || 
                                btn.textContent.includes('确定')
                            )) {
                                confirmButton = btn;
                                break;
                            }
                        }
                    }
                    
                    if (confirmButton) {
                        confirmButton.click();
                    }
                }, 500);
            } catch (e) {
                console.error('离开聊天失败:', e);
            }
        }
    }

    // 检测对方性别
    function detectPartnerGender() {
        // 尝试多种可能的选择器来找到对方信息
        const infoSelectors = [
            "#partnerInfoText",
            ".partner-info",
            ".user-info",
            ".info-text"
        ];
        
        let infoElement = null;
        for (const selector of infoSelectors) {
            infoElement = document.querySelector(selector);
            if (infoElement) break;
        }
        
        // 如果通过选择器没找到，尝试通过文本查找
        if (!infoElement) {
            const elements = document.querySelectorAll('div, span, p');
            for (const el of elements) {
                if (el.textContent && (
                    el.textContent.includes('性别') || 
                    el.textContent.includes('男生') || 
                    el.textContent.includes('女生')
                )) {
                    infoElement = el;
                    break;
                }
            }
        }
        
        if (infoElement && infoElement.textContent) {
            const text = infoElement.textContent;
            if (text.includes("女生")) {
                return "female";
            } else if (text.includes("男生")) {
                return "male";
            }
        }
        
        return "unknown";
    }

    // 主循环
    function startMainLoop() {
        if (mainInterval) {
            clearInterval(mainInterval);
        }
        
        mainInterval = setInterval(() => {
            if (!isScriptRunning) return;

            const gender = detectPartnerGender();
            
            if (gender === "female") {
                // 匹配到女生
                if (firstAuto) {
                    firstAuto = false;
                    
                    setTimeout(() => {
                        const greetings = getRandomGreeting();
                        let currentGreetingIndex = 0;
                        
                        function sendNextGreeting() {
                            if (currentGreetingIndex < greetings.length) {
                                const sent = sendMessage(greetings[currentGreetingIndex]);
                                if (sent) {
                                    currentGreetingIndex++;
                                    // 每隔3秒发送下一条问候语
                                    setTimeout(sendNextGreeting, 3000);
                                } else {
                                    // 如果发送失败，稍后重试
                                    setTimeout(() => sendNextGreeting(), 1000);
                                }
                            }
                        }
                        
                        sendNextGreeting();
                    }, 1000);
                }
            } else if (gender === "male") {
                // 匹配到男生，离开
                firstAuto = true;
                leave();
            }
        }, 1500);
    }

    // 初始化UI和功能
    function initializeUI() {
        // 等待页面加载完成
        setTimeout(() => {
            createControlButton();
            createContactButton();
            createConfigPanel();

            // 绑定配置面板事件
            document.addEventListener('click', function(e) {
                if (e.target.id === 'ssby-save') {
                    saveConfigFromPanel();
                } else if (e.target.id === 'ssby-close') {
                    hideConfigPanel();
                }
            });

            // 触摸事件绑定
            document.addEventListener('touchstart', function(e) {
                if (e.target.id === 'ssby-save') {
                    e.preventDefault();
                    saveConfigFromPanel();
                } else if (e.target.id === 'ssby-close') {
                    e.preventDefault();
                    hideConfigPanel();
                }
            }, { passive: false });
            
            // 启动主循环
            if (isScriptRunning) {
                startMainLoop();
            }
            
            console.log('叔叔不约脚本已初始化');
        }, 2000);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUI);
    } else {
        initializeUI();
    }

})();