(function(){
  // Prevent page zoom on iPad (pinch & double-tap)
  document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
  document.addEventListener('gesturechange', function(e){ e.preventDefault(); });
  document.addEventListener('gestureend', function(e){ e.preventDefault(); });
  document.addEventListener('touchstart', function(e){ if(e.touches.length>1) e.preventDefault(); }, {passive:false});

  // Mobile detection & UI scaling
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (window.matchMedia('(max-width:768px)').matches && 'ontouchstart' in window);

  if(isMobile){
    var s=document.getElementById('tmux-toggle').style;
    s.width='72px';s.height='72px';s.fontSize='30px';s.borderRadius='14px';

    ['tmux-esc','tmux-paste','tmux-scroll-btn'].forEach(function(id){
      var el=document.getElementById(id);
      if(!el)return;
      var s=el.style;
      s.width='80px';s.height='72px';s.fontSize=(id==='tmux-paste'||id==='tmux-scroll-btn')?'30px':'20px';
      s.borderRadius='14px';
    });

    var panel=document.getElementById('tmux-panel');
    if(panel){
      panel.style.minWidth='260px';
      var btns=panel.querySelectorAll('button');
      for(var i=0;i<btns.length;i++){
        btns[i].style.height='52px';btns[i].style.fontSize='16px';
      }
      // Fix D-pad grid for mobile
      var dpad=document.getElementById('tmux-dpad');
      if(dpad){
        dpad.style.gridTemplateColumns='52px 52px 52px';
        dpad.style.gridTemplateRows='52px 52px';
        dpad.style.gap='6px';
      }
      // Fix action/window grids
      var grids=panel.querySelectorAll('#tmux-actions,#tmux-windows');
      for(var i=0;i<grids.length;i++){
        grids[i].style.gap='6px';
      }
    }
  }

  var readyCheck = setInterval(function(){
    if(window.term && window.term.fit){
      clearInterval(readyCheck);
      if(isMobile) window.term.options.fontSize = 18;
      document.fonts.ready.then(function(){
        window.term._core.viewport.scrollBarWidth = 0;
        window.term.fit();
        setTimeout(function(){
          window.term._core.viewport.scrollBarWidth = 0;
          window.term.fit();
        }, 500);
        window.addEventListener('resize', function(){
          window.term._core.viewport.scrollBarWidth = 0;
          window.term.fit();
        });
      });
    }
  }, 100);

  // Toggle panel
  var toggle=document.getElementById('tmux-toggle');
  var panel=document.getElementById('tmux-panel');
  toggle.addEventListener('click',function(){
    var open=panel.classList.toggle('open');
    toggle.classList.toggle('open',open);
  });

  // WS helpers
  var arrows={Up:'\x1b[A',Down:'\x1b[B',Right:'\x1b[C',Left:'\x1b[D'};
  function sendBytes(bytes){
    var ws=window.__ttydWS;
    if(!ws||ws.readyState!==1)return;
    var buf=new Uint8Array(1+bytes.length);
    buf[0]=48;
    for(var i=0;i<bytes.length;i++) buf[i+1]=bytes[i];
    ws.send(buf);
  }
  function sendStr(s){
    var arr=[];
    for(var i=0;i<s.length;i++) arr.push(s.charCodeAt(i));
    sendBytes(arr);
  }
  function tmuxPrefix(){ sendBytes([0x02]); }
  function refocus(){
    var ta=document.querySelector('.xterm-helper-textarea');
    if(ta) ta.focus();
  }

  // Mobile: swipe to scroll like mouse wheel (tmux auto copy-mode)
  if(isMobile){
    var touchStartY=0;
    var touchAccum=0;
    var SCROLL_THRESHOLD=30;

    // Hide scroll button on mobile — not needed with native-like scroll
    var scrollBtn=document.getElementById('tmux-scroll-btn');
    if(scrollBtn) scrollBtn.style.display='none';

    document.addEventListener('touchstart',function(e){
      if(e.touches.length===1){
        // Only scroll if touch is on the terminal area, not overlay buttons
        var t=e.target;
        if(t.closest('#tmux-overlay')||t.closest('#tmux-prompt-overlay'))return;
        touchStartY=e.touches[0].clientY;
        touchAccum=0;
      }
    },{passive:true});
    document.addEventListener('touchmove',function(e){
      if(e.touches.length!==1)return;
      var t=e.target;
      if(t.closest('#tmux-overlay')||t.closest('#tmux-prompt-overlay'))return;

      var dy=touchStartY-e.touches[0].clientY;
      touchAccum+=dy;
      touchStartY=e.touches[0].clientY;

      // SGR mouse wheel: \x1b[<64;col;rowM (up) \x1b[<65;col;rowM (down)
      // Build as raw bytes to avoid string encoding issues
      while(touchAccum>SCROLL_THRESHOLD){
        // Scroll up: ESC [ < 6 4 ; 4 0 ; 1 2 M
        sendBytes([0x1b,0x5b,0x3c,0x36,0x34,0x3b,0x34,0x30,0x3b,0x31,0x32,0x4d]);
        touchAccum-=SCROLL_THRESHOLD;
      }
      while(touchAccum<-SCROLL_THRESHOLD){
        // Scroll down: ESC [ < 6 5 ; 4 0 ; 1 2 M
        sendBytes([0x1b,0x5b,0x3c,0x36,0x35,0x3b,0x34,0x30,0x3b,0x31,0x32,0x4d]);
        touchAccum+=SCROLL_THRESHOLD;
      }
    },{passive:true});
  }

  // Prompt dialog
  var promptOverlay=document.getElementById('tmux-prompt-overlay');
  var promptLabel=document.getElementById('tmux-prompt-label');
  var promptInput=document.getElementById('tmux-prompt-input');
  var promptOk=document.getElementById('tmux-prompt-ok');
  var promptCancel=document.getElementById('tmux-prompt-cancel');
  var promptCallback=null;

  function showPrompt(label, cb){
    promptLabel.textContent=label;
    promptInput.value='';
    promptCallback=cb;
    promptOverlay.classList.add('open');
    setTimeout(function(){ promptInput.focus(); },50);
  }
  function closePrompt(){
    promptOverlay.classList.remove('open');
    promptCallback=null;
    refocus();
  }
  promptCancel.addEventListener('click', closePrompt);
  promptOk.addEventListener('click', function(){
    var val=promptInput.value.trim();
    var cb=promptCallback;
    closePrompt();
    if(val && cb) setTimeout(function(){ cb(val); },200);
  });
  promptInput.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ e.preventDefault(); promptOk.click(); }
    if(e.key==='Escape'){ closePrompt(); }
    e.stopPropagation();
  });
  promptOverlay.addEventListener('click', function(e){
    if(e.target===promptOverlay) closePrompt();
  });

  // tmux command sender: Ctrl-b : <cmd> Enter
  function tmuxCommand(cmd){
    tmuxPrefix();
    setTimeout(function(){
      sendStr(':');
      setTimeout(function(){
        sendStr(cmd);
        setTimeout(function(){
          sendBytes([0x0d]); // Enter
          refocus();
        },80);
      },80);
    },150);
  }

  // D-pad
  document.getElementById('tmux-dpad').addEventListener('click',function(e){
    var btn=e.target.closest('button[data-dir]');
    if(!btn)return;
    tmuxPrefix();
    setTimeout(function(){ sendStr(arrows[btn.dataset.dir]); refocus(); },50);
  });

  // Actions
  var actions={
    'zoom':    function(){ tmuxPrefix(); setTimeout(function(){ sendStr('z'); refocus(); },50); },
    'scroll':  function(){ tmuxPrefix(); setTimeout(function(){ sendStr('['); refocus(); },50); },
    'split-h': function(){ tmuxPrefix(); setTimeout(function(){ sendStr('"'); refocus(); },50); },
    'split-v': function(){ tmuxPrefix(); setTimeout(function(){ sendStr('%'); refocus(); },50); },
    'kill':    function(){ tmuxPrefix(); setTimeout(function(){ sendStr('x'); refocus(); },50); },
    'rename-pane': function(){
      showPrompt('Rename pane:', function(name){
        tmuxCommand('select-pane -T "'+name.replace(/"/g,'\\"')+'"');
      });
    },
    'new-window': function(){ tmuxPrefix(); setTimeout(function(){ sendStr('c'); refocus(); },50); },
    'kill-window': function(){ tmuxPrefix(); setTimeout(function(){ sendStr('&'); refocus(); },50); },
    'rename-window': function(){
      showPrompt('Rename window:', function(name){
        tmuxCommand('rename-window "'+name.replace(/"/g,'\\"')+'"');
      });
    }
  };

  // Standalone ESC button
  document.getElementById("tmux-esc").addEventListener("click",function(){
    sendBytes([0x1b]); refocus();
  });

  // Paste from clipboard button
  document.getElementById("tmux-paste").addEventListener("click",function(){
    navigator.clipboard.readText().then(function(text){
      if(text) sendStr(text);
      refocus();
    }).catch(function(){
      refocus();
    });
  });

  // Keys section
  var keyMap={
    "esc":function(){ sendBytes([0x1b]); },
    "tab":function(){ sendBytes([0x09]); },
    "ctrl-c":function(){ sendBytes([0x03]); },
    "ctrl-d":function(){ sendBytes([0x04]); }
  };
  document.getElementById("tmux-keys").addEventListener("click",function(e){
    var btn=e.target.closest("button[data-key]");
    if(!btn)return;
    var fn=keyMap[btn.dataset.key];
    if(fn){ fn(); refocus(); }
  });


  document.addEventListener('click',function(e){
    var btn=e.target.closest('#tmux-actions button[data-action], #tmux-windows button[data-action]');
    if(!btn)return;
    var fn=actions[btn.dataset.action];
    if(fn) fn();
  });
})();