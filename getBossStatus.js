javascript: (function() {
    function initBossHrStatus(){
        let isPageChange = false;

        function alertBox(msg) {
            var div = document.createElement('div');
            div.style.cssText = 'position: fixed; top: 20%; left: 50%; transform: translate(-50%, -50%); background-color: rgb(0 190 189); border-radius: 5px; color: #fff; z-index: 9999; padding: 20px 100px; font-size: 20px; box-shadow: 0px 0px 10px rgba(0,0,0,.2);';
            div.innerHTML = msg;
            document.body.appendChild(div);
            setTimeout(function() {
                document.body.removeChild(div);
            },
            2000);
        }
        function reBindClick() {
            let pages = document.querySelectorAll('.options-pages a');
            /*因为分页每次点击都会重新渲染，所以需要点击后用定时器重新运行方法"*/
            for (let i = 0; i < pages.length; i++) {
                pages[i].addEventListener('click',
                function() {
                    isPageChange = true;
                    setTimeout(function() {
                        new initBossHrStatus();
                    },
                    1000);
                })
            }
        }
        async function getListStatus(){
            alertBox('开始更新状态....,网站安全策略问题，更新会比较缓慢。');
            let links = Array.from(document.querySelectorAll('.job-list-box .job-card-left')).filter((node)=>{
                let online = node.querySelector('.boss-online-tag');
                if(online){
                    setText(node,'在线');
                }
                return !online;
            });
    
            function setText(node,statusTxt){
                let pNode = document.createElement('p');
                pNode.innerHTML = statusTxt;
                console.log(statusTxt);
                pNode.style.cssText = "display:flex;padding:5px;background:#e1f5e3;color:green;";
                node.querySelector('.job-info').after(pNode);
            }
            /*要把在线的过滤掉，一来减少请求，二来请求的数据也不存在下面代码的class .boss-active-time，会报错'*/
            for (let i = 0; i < links.length; i++) {
                if(isPageChange){
                    /*切换了分页， 要中断循环*/
                    break;
                }
                await new Promise((resolve) => {
                    setTimeout(()=>{
                        /*做个延时处理，好像boss有做ddos处理，频繁请求会触发302重定向，最终导致拿不到html页面数据*/
                        resolve();
                    }, 2000);
                });
                let node = links[i];
                let link = node.href;
                let statusTxt = await getHtml(link);
                console.log(statusTxt);
                if(statusTxt===''){
                    statusTxt = '未知状态';
                }
                setText(node,statusTxt);
                if(i===links.length){
                    alertBox('更新完成');
                }
            }
            
            
        }
        
        function getHtml(link){
            function fetchHtml(){
                /*设置不允许重定向，让其报错，报错后通过iframe来获取数据，虽然慢点，但起码可以获取到数据*/
                return fetch(link, { redirect: 'error' }) 
                .then((res)=>{    
                    return res.text();
                }).then(async(data)=>{    
                    const divNode = document.createElement("div");
                    divNode.insertAdjacentHTML('afterbegin', data);
                    const node = divNode.querySelector('.boss-active-time');
                    return node?node.textContent:'猎头，或者没状态的hr';
                }).catch(async(error)=>{
                    /*请求被302临时重定向了，无法获取到数据，需要用iframe来获取了*/
                    return await getStatusByIframe(link);
                })
            }
            return fetchHtml();
        }
        
        
        async function getStatusByIframe(link){
            let iframe = document.createElement('iframe');
            iframe.src = link;
            iframe.id = 'tempIframe';
            iframe.style.cssText = "width:0;height:0;";
            document.body.appendChild(iframe);
           
            return await new Promise((resolve)=>{
                let iframe = document.querySelector('#tempIframe');
                iframe.onload = function(){
                    let node = iframe.contentWindow.document.querySelector('.boss-active-time');
    
                    function returnVal(){
                        let status = node?node.textContent:'可能不存在状态，也可能没获取到真实数据,大概率后者';
                        resolve(status);
                        setTimeout(()=>{
                            document.body.removeChild(iframe);
                        },500)
                    }
    
                    if(node){
                        returnVal();
                    }else{
                        /*应该是iframe页面也触发了302临时重定向，导致这时候获取，不能拿到真正的数据，所以延迟试试，但这个延时不好控制，调小了，获取不到数据，调大了，显得反应很慢（不过慢其实没啥影响，因为你不可能一下子浏览全部列表数据，一条一条来，应该是可以的）*/
                        setTimeout(()=>{
                            node = iframe.contentWindow.document.querySelector('.boss-active-time');
                            returnVal();
                        },2000)
                    }
                }
                
            })          
        }
        reBindClick();
        getListStatus();
        return true;
    }
    /*虽然反应速度可能不是很理想，但只是个小功能，所以有效果就行，不想继续优化了*/
    new initBossHrStatus();
})()
