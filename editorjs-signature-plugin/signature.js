// this plugin place the standard signature and/or the counterpart signature placeholder
// compatible with editor.js > 4.x
export default class Signature {
    // load previos data if any
    constructor({data,api,config}){
        // get api handle
        this.api = api;
        // load config data if any
        this.config = config || {};
        this.data = {
            url: data.url || '',
            caption: data.caption || ''
        };
        // clean the wrapper
        this.wrapper = undefined;
    }
    // add the plugin to the toolbox of editor.js (mandatory method)
    static get toolbox() {
      return {
        title: 'Signature',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16"> <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>'
        };
    }
    // rendering of the signature (mandatory method to be defined)
    render(){
        this.wrapper = document.createElement('div');
        const input = document.createElement('input');
        this.wrapper.classList.add('signature');
        // load previous data if any
        if (this.data && this.data.url){
            this._createImage(this.data.url, this.data.caption);
            return this.wrapper;
        }
        // load data from configuration
        this._createImage(this.config.standardsignature);
        return this.wrapper;
    }
    // internal function to render the signature image
    _createImage(url,captionText){
        const image = document.createElement('img');
        const caption = document.createElement('input');
        image.src = url;
        caption.placeholder = 'Title';
        caption.value = captionText || '';    
        this.wrapper.innerHTML = '';
        this.wrapper.appendChild(image);
        this.wrapper.appendChild(caption);
    }
    // save function  to return the json structure representing the signature
    save(blockContent){
        const image = blockContent.querySelector('img');
        const caption = blockContent.querySelector('input');
        return {
          url: image.src,
          caption: caption.value
        }
    }
    //Automatic sanitize config, it's called from edit.js at the saving 
    static get sanitize(){
        return {
        url: false, // disallow HTML
        caption: {} // only tags from Inline Toolbar 
        }
    }
    // render the settings for options to place signature place holder or back the standard signature
    renderSettings(){
        return( [
            {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-input-cursor" viewBox="0 0 16 16"><path d="M10 5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4v1h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4v1zM6 5V4H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v-1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4z"/><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0v-13A.5.5 0 0 1 8 1z"/></svg>',
            label: 'Placeholder',
            name: 'SignaturePlaceHolder',
            onActivate: () => {
                this._createImage(this.config.counterpartsignature, '');
                }
            },
            {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16"> <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>',
            label: 'Signature',
            name: 'SignatureStandard',
            onActivate: () => {
                this._createImage(this.config.standardsignature, '');
                }
            }
        ]);
        
    }
}
export { Signature};
