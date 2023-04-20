// ==UserScript==
// @name         showBossActiveTime
// @namespace    http://www.chensong.cc/
// @version      0.3
// @description  to show hr lastest login time,help you deliver your resume efficiently.
// @author       chensong
// @match        https://www.zhipin.com/web/geek/job*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant       GM_xmlhttpRequest
// @license     MIT 
// ==/UserScript==

(function () {
  'use strict';

  function showBossActiveTime() {
    let isUpdating = false;
    let statusOptions = localStorage.getItem('bossActiveStatusList')?.split(',')||['半年前活跃', '近半年活跃','4月前活跃','2月内活跃','2周内活跃'];
    let removeStatusList = [];

    const style = `
    #removeFilterDataContainer{
      position: fixed;right: 70px;top: 70px;z-index: 20000;background: #00bebd; color: #fff;display: flex;flex-direction: column;padding-bottom:10px
    }
    #removeFilterDataContainer.hide{height:28px;overflow:hidden}
    #removeFilterDataContainer.hide #boss-active-time-arrow svg{transform: rotate(180deg);}
    #removeFilterDataContainer #boss-active-time-arrow {cursor: pointer; display: flex;justify-content: flex-end;font-size: 24px;background: #009796;padding:2px 10px;}
    #removeFilterDataContainer .tips{font-size:16px;margin:5px 20px;}
    #removeFilterDataContainer label{display:flex;padding:0 20px;}
    #removeFilterDataContainer label input{margin-right:5px;}
    `;
    const styleEle = document.createElement('style');
    styleEle.innerHTML = style;
    document.head?.appendChild(styleEle);

    function getLis() {
      /*要把在线的过滤掉，一来减少请求，二来请求的数据也不存在下面代码的class .boss-active-time，会报错'*/
      let links = Array.from(
        document.querySelectorAll('.job-list-box .job-card-left')
      ).filter((node) => {
        let online = node.querySelector('.boss-online-tag');
        if (online) {
          setText(node, '在线');
        }
        return !online;
      });
      return links;
    }

    function setText(node, statusText) {
      let pNode = document.createElement('p');
      pNode.className = 'status';
      pNode.style.cssText =
        'display:flex;padding:5px 10px;background:#e1f5e3;color:green;width:80%;border-radius:4px;margin-top:10px;';
      node.querySelector('.job-info').after(pNode);
      pNode.parentNode.style.height = 'auto';
      pNode.parentNode.style.paddingBottom = '0';
      let chatBtn = node.querySelector('.start-chat-btn');
      let chatState = chatBtn.textContent==='立即沟通'?'':'\n&nbsp;&nbsp;&nbsp;&nbsp;已经沟通过了';
      pNode.innerHTML = statusText+chatState;
      pNode.setAttribute('status',statusText);
      //console.log(statusText);
      // 隐藏要过滤的数据
      if(removeStatusList.length){
        setDomDisplay(node,statusText);
      }
      // 保存一下状态数据
      if(!statusOptions.includes(statusText)&&statusText!=='在线'){
        statusOptions.push(statusText);
        localStorage.setItem('bossActiveStatusList',statusOptions);
      }
    }

    async function getListStatus() {
      alertBox('开始更新状态....,网站安全策略问题，更新会比较缓慢。');
      let links = getLis();
      isUpdating = true;
      for (let i = 0; i < links.length; i++) {
        if (!isUpdating) {
        //  有方法通知更新需要中断，停止循环
          break;
        }
        let node = links[i];
        let link = node.href;
        await new Promise((resolve) => {
          setTimeout(async () => {
            /*做个延时处理，频繁请求会触发302重定向，最终导致拿不到html页面数据*/
            GM_xmlhttpRequest({
              method: 'GET',
              url: link,
              onload: function (response) {
                if (/security-check.html/.test(response.finalUrl)) {
                 // console.log(response.finalUrl, 888);
                  //    用GM_xmlhttpRequest获取触发了302，用finaleUrl通过iframe来获取，不用link,看是否能省略302这个步骤,加快速度
                  getStatusByIframe(response.finalUrl, i).then((res) => {
                    if (res === '') {
                      res = '未知状态';
                    }
                    setText(node, res);
                  });
                } else {
                  const html = response.responseText;
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(html, 'text/html');
                  const statusText = getStatusText(doc);
                  setText(node, statusText);
                }
              }
            });
            resolve();
          }, 1000);
        });
        if (i === links.length - 1) {
          isUpdating = false;
          alertBox('更新完成');
          
        }
      }
    }

    async function getStatusByIframe(link, id) {
      let iframe = document.createElement('iframe');
      iframe.src = link;
      iframe.id = 'tempIframe' + id;
      iframe.style.cssText = 'width:0;height:0;';
      document.body.appendChild(iframe);

      return await new Promise((resolve) => {
        let tempIframe = document.querySelector('#tempIframe' + id);
        tempIframe.onload = function () {
          setTimeout(() => {
            if (tempIframe.contentWindow?.document) {
              const statusText = getStatusText(
                tempIframe.contentWindow.document
              );
              resolve(statusText);
              console.log('用iframe获取', statusText);
              setTimeout(() => {
                document.body.removeChild(tempIframe);
              }, 500);
            }
          }, 5000);
        };
      });
    }
    function pageBtnBindClick() {
      let pages = document.querySelectorAll('.options-pages a');
      /*因为分页每次点击都会重新渲染，所以需要点击后用定时器重新运行方法"*/
      for (let i = 0; i < pages.length; i++) {
        pages[i].addEventListener('click', function () {
          isUpdating = false;
          setTimeout(function () {
            init();
          }, 1000);
        });
      }
    }
    function alertBox(msg) {
      var div = document.createElement('div');
      div.style.cssText =
        'position: fixed; top: 20%; left: 50%; transform: translate(-50%, -50%); background-color: rgb(0 190 189); border-radius: 5px; color: #fff; z-index: 9999; padding: 20px 100px; font-size: 20px; box-shadow: 0px 0px 10px rgba(0,0,0,.2);';
      div.innerHTML = msg;
      document.body.appendChild(div);
      setTimeout(function () {
        document.body.removeChild(div);
      }, 2000);
    }
    function getStatusText(doc) {
      const timeNode = doc.querySelector('.boss-active-time');
      if (timeNode) {
        console.log('用接口获取', timeNode.textContent);
        return timeNode.textContent;
      } else {
        // 没有获取到状态，但页面是已经加载到的了
        const isHunter = ['.certification-tags', '.boss-info-attr'].filter(
          (name) => {
            const node = doc.querySelector(name);
            return /猎头|人力|经纪/.test(node.textContent);
          }
        );
        const status = isHunter
          ? '猎头，没有活跃状态'
          : '获取到数据了，但不知道是什么数据';
        return status;
      }
    }
    function addStatusFilter(){
      const container = document.createElement('div');
      container.id='removeFilterDataContainer';
      const tips = document.createElement('div');
      tips.innerHTML = '过滤掉勾选的数据';
      tips.className = 'tips';
      const arrow = document.createElement('div');
      arrow.id='boss-active-time-arrow';
      arrow.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>';
      container.appendChild(arrow);
      container.appendChild(tips);
      arrow.addEventListener('click',function(){
        container.classList.contains('hide')?container.classList.remove('hide'):container.classList.add('hide');
      })

      statusOptions.forEach(option => {
        const label = document.createElement('label');
        const el = document.createElement('input');
        el.type = 'checkbox';
        el.name = option;
        el.value = option;
        label.appendChild(el);
        label.appendChild(document.createTextNode(option));
        container.appendChild(label);
      });


      const loopDom = function(){
        const nodes = Array.from(
          document.querySelectorAll('.job-list-box .job-card-left')
        ).filter((node) => {
          let online = node.querySelector('.boss-online-tag');
          return !online;
        });
        for (const node of nodes) {
          const pNode = node.querySelector('.status');
          // 有些数据还没获取到状态
          if(pNode){
            const status = pNode.getAttribute('status');
            setDomDisplay(node,status);
          }
        }
      }

      container.addEventListener('change', function(event) {
        const selectedValues = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
        removeStatusList = selectedValues;
        loopDom();
        // 如果正在更新,需要定时器定时查询最新数据，不然后面更新的数据不能触发loopDom
        if(isUpdating){
          const timer = setInterval(()=>{
            // 如果已经更新完毕，清除定时器,这里面多次选择会触发多个定时器，可以把timer提到外面避免这个问题，但因为实际使用中，重复调用的代价并不明显，也因为懒，就不提出到外面了
            if(!isUpdating){
              clearInterval(timer);
            }
            loopDom();
          },2000);
        }
      });

      document.body.appendChild(container);

    }
    function setDomDisplay(node,statusText){
      const liNode = node.parentElement.parentElement;
      if(removeStatusList.includes(statusText)){
        liNode.style.display = 'none';
      }else{
        liNode.style.display = 'block';
      }
    }
    

    function init() {
      pageBtnBindClick();
      getListStatus();
    }
    
    init();
    addStatusFilter();
  }
  window.onload = function () {
    setTimeout(() => {
      showBossActiveTime();
    }, 2000);
  };
})();
