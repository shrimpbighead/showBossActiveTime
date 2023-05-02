javascript:(function () {
  'use strict';

  class ShowBossActiveTime {
    constructor(options) {
      this.startTime = null;/*记录是否是当前列表数据的循环，如果没查询完毕就重新触发的新的实例化，需要去停止旧的查询循环*/
      this.statusOptions = localStorage
        .getItem('bossActiveStatusList')
        ?.split(',').filter(t=>t.length) || [
        '半年前活跃',
        '近半年活跃',
        '4月前活跃',
        '2月内活跃',
        '2周内活跃'
      ];
      this.removeStatusList = [];
      this.options = Object.assign(
        {
          listElement: '.job-card-wrapper',
          onlineElement: '.boss-online-tag',
          chatElement: '.start-chat-btn',
          hunterElement: '.job-tag-icon',
          linkElement: '.job-card-left',
          paginationElement: '.options-pages',
          hideChated: false
        },
        options
      );
      this.queque = []; /*查询队列*/
      this.list = []; /*数据列表*/
      /*添加过滤条件，因为要保存选择数据，所以这个不能切换时清空*/
      this.addStatusFilter();
      this.addStyleSheet();
      /*监听请求数据事件*/ 
      this.observeLoadingData();
      this.request = this.requestInit();
      this.init();
    }

    addStyleSheet() {
      const style = `
            .show-active-status{display:flex;padding:5px 10px;background:#e1f5e3;color:green;width:80%;border-radius:4px;margin-top:10px;}
            .show-active-status .status{}
            .show-active-status .chat{}
            #alertBox{position: fixed; top: 20%; left: 50%; transform: translate(-50%, -50%); background-color: rgb(0 190 189); border-radius: 5px; color: #fff; z-index: 9999; padding: 20px 40px; font-size: 20px; box-shadow: 0px 0px 10px rgba(0,0,0,.2);}
            #removeFilterDataContainer{
            position: fixed;right: 70px;top: 70px;z-index: 20000;background: #00bebd; color: #fff;display: flex;flex-direction: column;padding-bottom:10px
            }
            #removeFilterDataContainer.hide{height:28px;overflow:hidden}
            #removeFilterDataContainer .title {display:flex;justify-content: space-around;}
            #removeFilterDataContainer .title label{align-items:center;padding:0 15px;}
            #removeFilterDataContainer.hide #boss-active-time-arrow svg{transform: rotate(180deg);}
            #removeFilterDataContainer #boss-active-time-arrow {cursor: pointer;font-size: 24px;background: #009796;padding:2px 10px;line-height:1;}
            #removeFilterDataContainer .tips{font-size:16px;margin:5px 20px;}
            #removeFilterDataContainer label{display:flex;padding:0 20px;}
            #removeFilterDataContainer label input{margin-right:5px;}
            `;
      const styleEle = document.createElement('style');
      styleEle.id = 'show-boss-active-time-css';
      styleEle.innerHTML = style;
      document.head?.appendChild(styleEle);
    }

    /*获取节点列表*/ 
    getList() {
      Array.from(document.querySelectorAll(this.options.listElement)).forEach(
        (node, index) => {
          const status = node.querySelector(this.options.onlineElement);
          this.list.push(node);
          /*不在线*/ 
          if (!status) {
            this.queque.push(node);
          }
        }
      );
    }
    /*设置文本内容*/ 
    setText(node, text, status) {
      const html = `
        <div class="show-active-status">
          <p class="status">${text}</p>&nbsp;&nbsp;&nbsp;&nbsp;
          <p class="chat">${status}</p>
        </div>
      `;
      node.querySelector('.job-info').insertAdjacentHTML('afterend', html);
      let aEle = node.querySelector('a');
      aEle.style.height = 'auto';
      aEle.style.paddingBottom = '0';
      if(!this.statusOptions.includes(text)&&text!=='在线'){
        this.statusOptions.push(text);
        localStorage.setItem('bossActiveStatusList',this.statusOptions);
      }
    }
    async getListStatus() {
      this.alertBox('开始更新状态....,网站安全策略问题，更新会比较缓慢。');
      const startTime = new Date().getTime();
      this.startTime = startTime;
      for (let i = 0; this.queque.length > 0; i++) {
        let node = this.queque.shift();
        let link = node.querySelector(this.options.linkElement).href;
        let chat = node.querySelector(this.options.chatElement).textContent;
        await new Promise((resolve) => {
          setTimeout(async () => {
            /*做个延时处理，频繁请求会触发302重定向，最终导致拿不到html页面数据*/
            await this.request(link, node, chat, this.queque.length);
            resolve();
          }, 1000);
        });
        if(startTime!==this.startTime){
          /*中断旧的循环查询*/ 
          return;
        }
      }
      if (this.queque.length === 0) {
        this.startTime = null;
        setTimeout(()=>{
          this.alertBox('查询完毕，更新即将完成');
        },1500);
      }
    }
    requestInit(){
      /*如果是油猴，使用GM_xmlhttpRequest，如果不是，使用fetch*/
      if (window.GM_xmlhttpRequest) {
        return (link, node, chat, index) => {
          return GM_xmlhttpRequest({
            method: 'GET',
            url: link,
            onload: (response) => {
              if (/security-check.html/.test(response.finalUrl)) {
                /*用GM_xmlhttpRequest获取触发了302，用finaleUrl通过iframe来获取，不用link,看是否能省略302这个步骤,加快速度*/    
                this.getStatusByIframe(response.finalUrl, index).then(
                  (text) => {
                    if (text === '') {
                      text = '未知状态';
                    }
                    this.setText(node, text, chat);
                    this.toggleDom(node);
                  }
                );
              } else {
                const html = response.responseText;
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const text = this.getStatusText(doc);
                this.setText(node, text, chat);
                this.toggleDom(node);
              }
            }
          });
        };
      } else {
        return (link, node, chat, index) => {
          /*设置不允许重定向，让其报错，报错后通过iframe来获取数据，虽然慢点，但起码可以获取到数据*/
          return fetch(link, { redirect: 'error' })
            .then((res) => {
              return res.text();
            })
            .then(async (data) => {
              const doc = document.createElement('div');
              doc.insertAdjacentHTML('afterbegin', data);
              const text = this.getStatusText(doc);
              this.setText(node, text, chat);
              this.toggleDom(node);
            })
            .catch(async (error) => {
              /*请求被302临时重定向了，无法获取到数据，需要用iframe来获取了*/
              this.getStatusByIframe(link, index).then((text) => {
                if (text === '') {
                  text = '未知状态';
                }
                this.setText(node, text, chat);
                this.toggleDom(node);
              });
            });
        };
      }
    }
    async getStatusByIframe(link, id) {
      let iframe = document.createElement('iframe');
      iframe.src = link;
      iframe.id = 'tempIframe' + id;
      iframe.style.cssText = 'width:0;height:0;';
      document.body.appendChild(iframe);

      return await new Promise((resolve) => {
        let tempIframe = document.querySelector('#tempIframe' + id);
        tempIframe.onload = () => {
          setTimeout(() => {
            if (tempIframe.contentWindow?.document) {
              const text = this.getStatusText(
                tempIframe.contentWindow.document
              );
              resolve(text);
              console.log('用iframe获取', text);
              setTimeout(() => {
                document.body.removeChild(tempIframe);
              }, 500);
            }
          }, 5000);
        };
      });
    }
    observeLoadingData() {
      const container = document.querySelector('.search-job-result');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const addNode = mutation.addedNodes;
            const removedNode = mutation.removedNodes;
            if (
              addNode.length &&
              addNode[0].className === 'job-loading-wrapper'
            ) {
              console.log('触发了请求列表数据');
            }
            if (
              removedNode.length &&
              removedNode[0].className === 'job-loading-wrapper'
            ) {
              console.log('加载完成');
              this.clear();
              this.init();
            }
          }
        });
      });
      const config = { attributes: false, childList: true, subtree: false };
      observer.observe(container, config);

      /*监听是否是搜索列表页,不是就移除dom*/ 
      const listContainer = document.querySelector('#wrap');
      const listObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const wrapper = document.querySelector('.job-list-wrapper');
            const removeNode = document.querySelector("#removeFilterDataContainer");
            if(!wrapper&&removeNode){
              document.body.removeChild(removeNode);
              listObserver.disconnect();
              /*清除查询*/ 
              this.clear();
            }
          }
        });
      });
      listObserver.observe(listContainer, config);
    }
    alertBox(msg) {
      let div = document.createElement('div');
      div.id = 'alertBox';
      div.innerHTML = msg;
      document.body.appendChild(div);
      setTimeout(function () {
        document.body.removeChild(div);
      }, 2000);
    }
    getStatusText(doc) {
      const timeNode = doc.querySelector('.boss-active-time');
      if (timeNode) {
        return timeNode.textContent;
      } else {
        /*没有获取到状态，但页面是已经加载到的了*/ 
        const isHunter = ['.certification-tags', '.boss-info-attr'].filter(
          (name) => {
            const node = doc.querySelector(name);
            return /猎头|人力|经纪/.test(node?.textContent);
          }
        );
        const status = isHunter
          ? '猎头，没有活跃状态'
          : '获取到数据了，但不知道是什么数据';
        return status;
      }
    }
    toggleDom(node){
      const status = node.querySelector('.status')?.textContent;
      const chat = node.querySelector(this.options.chatElement).textContent;
      /*先显示全部*/ 
      node.style.display = 'block';
      /* 首先判断是否隐藏已沟通*/
      if (this.options.hideChated && chat === '继续沟通') {
        node.style.display = 'none';
      }
      /*状态数据已经获取了*/ 
      if (status && chat) {
        if (this.removeStatusList.includes(status)) {
          node.style.display = 'none';
        }
        if (this.options.hideChated && chat === '继续沟通') {
          node.style.display = 'none';
        }
      }
    }
    toggleDoms(){
      this.list.forEach((node) => {
        this.toggleDom(node);
      });
    }
    addStatusFilter() {
      const container = document.createElement('div');
      container.id = 'removeFilterDataContainer';
      const html = `
      <label><input type="checkbox" name="hideChated" value="1">过滤已经沟通过的</label>
      <div id="boss-active-time-arrow"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" height="1em" width="1em" xmlns="http:/**/www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg></div>
      `;
      const title = document.createElement('div');
      title.className = 'title';
      title.innerHTML = html;
      const tips = document.createElement('div');
      tips.innerHTML = '过滤掉勾选的数据';
      tips.className = 'tips';
      container.appendChild(title);
      container.appendChild(tips);
      container
        .querySelector('#boss-active-time-arrow')
        .addEventListener('click', function () {
          container.classList.contains('hide')
            ? container.classList.remove('hide')
            : container.classList.add('hide');
        });

      this.statusOptions.forEach((option) => {
        const label = document.createElement('label');
        const el = document.createElement('input');
        el.type = 'checkbox';
        el.name = option;
        el.value = option;
        el.className = 'status-checkbox';
        label.appendChild(el);
        label.appendChild(document.createTextNode(option));
        container.appendChild(label);
      });

      container.addEventListener('change', () => {
        const selectedValues = Array.from(
          container.querySelectorAll('.status-checkbox:checked')
        ).map((el) => el.value);
        this.removeStatusList = selectedValues;
        const hideNode = document.querySelector('input[name="hideChated"]');
        this.options.hideChated = hideNode?.checked;
        this.toggleDoms();
      });

      document.body.appendChild(container);
    }
    clear(){
      this.queque.length = 0;
      this.list.length = 0;
      this.startTime = null;
    }

    init() {
      /*获取列表数据*/ 
      this.getList();
      /*先给在线的数据设置状态*/ 
      this.list.forEach((node) => {
        const chat = node.querySelector(this.options.chatElement).textContent;
        const online = node.querySelector(this.options.onlineElement);
        if (online) {
          this.setText(node, '在线', chat);
        }
      });
      /*判断是否要隐藏已经沟通过的数据*/ 
      this.toggleDoms();
      /*请求数据，给不在线的设置状态*/ 
      this.getListStatus();
    }
  }
  function start() {
    const Lis = document.querySelectorAll('.job-card-wrapper');
    if (Lis.length) {
      new ShowBossActiveTime();
    } else {
      console.log('no start');
      setTimeout(start, 2000);
    }
  }
  start();
})();
