(function () {
    'use strict';

    /**
     * A collection of default build flags for a Stencil project.
     *
     * This collection can be found throughout the Stencil codebase, often imported from the `@app-data` module like so:
     * ```ts
     * import { BUILD } from '@app-data';
     * ```
     * and is used to determine if a portion of the output of a Stencil _project_'s compilation step can be eliminated.
     *
     * e.g. When `BUILD.allRenderFn` evaluates to `false`, the compiler will eliminate conditional statements like:
     * ```ts
     * if (BUILD.allRenderFn) {
     *   // some code that will be eliminated if BUILD.allRenderFn is false
     * }
     * ```
     *
     * `@app-data`, the module that `BUILD` is imported from, is an alias for the `@stencil/core/internal/app-data`, and is
     * partially referenced by {@link STENCIL_APP_DATA_ID}. The `src/compiler/bundle/app-data-plugin.ts` references
     * `STENCIL_APP_DATA_ID` uses it to replace these defaults with {@link BuildConditionals} that are derived from a
     * Stencil project's contents (i.e. metadata from the components). This replacement happens at a Stencil project's
     * compile time. Such code can be found at `src/compiler/app-core/app-data.ts`.
     */
    const BUILD = {
        allRenderFn: false,
        cmpDidLoad: true,
        cmpDidUnload: false,
        cmpDidUpdate: true,
        cmpDidRender: true,
        cmpWillLoad: true,
        cmpWillUpdate: true,
        cmpWillRender: true,
        connectedCallback: true,
        disconnectedCallback: true,
        element: true,
        event: true,
        hasRenderFn: true,
        lifecycle: true,
        hostListener: true,
        hostListenerTargetWindow: true,
        hostListenerTargetDocument: true,
        hostListenerTargetBody: true,
        hostListenerTargetParent: false,
        hostListenerTarget: true,
        member: true,
        method: true,
        mode: true,
        observeAttribute: true,
        prop: true,
        propMutable: true,
        reflect: true,
        scoped: true,
        shadowDom: true,
        slot: true,
        cssAnnotations: true,
        state: true,
        style: true,
        formAssociated: false,
        svg: true,
        updatable: true,
        vdomAttribute: true,
        vdomXlink: true,
        vdomClass: true,
        vdomFunctional: true,
        vdomKey: true,
        vdomListener: true,
        vdomRef: true,
        vdomPropOrAttr: true,
        vdomRender: true,
        vdomStyle: true,
        vdomText: true,
        watchCallback: true,
        taskQueue: true,
        hotModuleReplacement: false,
        isDebug: false,
        isDev: false,
        isTesting: false,
        hydrateServerSide: false,
        hydrateClientSide: false,
        lifecycleDOMEvents: false,
        lazyLoad: false,
        profile: false,
        slotRelocation: true,
        // TODO(STENCIL-914): remove this option when `experimentalSlotFixes` is the default behavior
        appendChildSlotFix: false,
        // TODO(STENCIL-914): remove this option when `experimentalSlotFixes` is the default behavior
        cloneNodeFix: false,
        hydratedAttribute: false,
        hydratedClass: true,
        scriptDataOpts: false,
        // TODO(STENCIL-914): remove this option when `experimentalSlotFixes` is the default behavior
        scopedSlotTextContentFix: false,
        // TODO(STENCIL-854): Remove code related to legacy shadowDomShim field
        shadowDomShim: false,
        // TODO(STENCIL-914): remove this option when `experimentalSlotFixes` is the default behavior
        slotChildNodesFix: false,
        invisiblePrehydration: true,
        propBoolean: true,
        propNumber: true,
        propString: true,
        constructableCSS: true,
        cmpShouldUpdate: true,
        devTools: false,
        shadowDelegatesFocus: true,
        initializeNextTick: false,
        asyncLoading: false,
        asyncQueue: false,
        transformTagName: false,
        attachStyles: true,
        // TODO(STENCIL-914): remove this option when `experimentalSlotFixes` is the default behavior
        experimentalSlotFixes: false,
    };

    /**
     * Virtual DOM patching algorithm based on Snabbdom by
     * Simon Friis Vindum (@paldepind)
     * Licensed under the MIT License
     * https://github.com/snabbdom/snabbdom/blob/master/LICENSE
     *
     * Modified for Stencil's renderer and slot projection
     */
    let scopeId;
    let contentRef;
    let hostTagName;
    let useNativeShadowDom = false;
    let checkSlotFallbackVisibility = false;
    let checkSlotRelocate = false;
    let isSvgMode = false;
    let renderingRef = null;
    let queuePending = false;
    const createTime = (fnName, tagName = '') => {
        {
            return () => {
                return;
            };
        }
    };
    /**
     * Constant for styles to be globally applied to `slot-fb` elements for pseudo-slot behavior.
     *
     * Two cascading rules must be used instead of a `:not()` selector due to Stencil browser
     * support as of Stencil v4.
     */
    const SLOT_FB_CSS = 'slot-fb{display:contents}slot-fb[hidden]{display:none}';
    const XLINK_NS = 'http://www.w3.org/1999/xlink';
    /**
     * Default style mode id
     */
    /**
     * Reusable empty obj/array
     * Don't add values to these!!
     */
    const EMPTY_OBJ = {};
    /**
     * Namespaces
     */
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const HTML_NS = 'http://www.w3.org/1999/xhtml';
    const isDef = (v) => v != null;
    /**
     * Check whether a value is a 'complex type', defined here as an object or a
     * function.
     *
     * @param o the value to check
     * @returns whether it's a complex type or not
     */
    const isComplexType = (o) => {
        // https://jsperf.com/typeof-fn-object/5
        o = typeof o;
        return o === 'object' || o === 'function';
    };
    /**
     * Helper method for querying a `meta` tag that contains a nonce value
     * out of a DOM's head.
     *
     * @param doc The DOM containing the `head` to query against
     * @returns The content of the meta tag representing the nonce value, or `undefined` if no tag
     * exists or the tag has no content.
     */
    function queryNonceMetaTagContent(doc) {
        var _a, _b, _c;
        return (_c = (_b = (_a = doc.head) === null || _a === void 0 ? void 0 : _a.querySelector('meta[name="csp-nonce"]')) === null || _b === void 0 ? void 0 : _b.getAttribute('content')) !== null && _c !== void 0 ? _c : undefined;
    }
    /**
     * Production h() function based on Preact by
     * Jason Miller (@developit)
     * Licensed under the MIT License
     * https://github.com/developit/preact/blob/master/LICENSE
     *
     * Modified for Stencil's compiler and vdom
     */
    // export function h(nodeName: string | d.FunctionalComponent, vnodeData: d.PropsType, child?: d.ChildType): d.VNode;
    // export function h(nodeName: string | d.FunctionalComponent, vnodeData: d.PropsType, ...children: d.ChildType[]): d.VNode;
    const h = (nodeName, vnodeData, ...children) => {
        let child = null;
        let key = null;
        let slotName = null;
        let simple = false;
        let lastSimple = false;
        const vNodeChildren = [];
        const walk = (c) => {
            for (let i = 0; i < c.length; i++) {
                child = c[i];
                if (Array.isArray(child)) {
                    walk(child);
                }
                else if (child != null && typeof child !== 'boolean') {
                    if ((simple = typeof nodeName !== 'function' && !isComplexType(child))) {
                        child = String(child);
                    }
                    if (simple && lastSimple) {
                        // If the previous child was simple (string), we merge both
                        vNodeChildren[vNodeChildren.length - 1].$text$ += child;
                    }
                    else {
                        // Append a new vNode, if it's text, we create a text vNode
                        vNodeChildren.push(simple ? newVNode(null, child) : child);
                    }
                    lastSimple = simple;
                }
            }
        };
        walk(children);
        if (vnodeData) {
            if (vnodeData.key) {
                key = vnodeData.key;
            }
            if (vnodeData.name) {
                slotName = vnodeData.name;
            }
            // normalize class / className attributes
            {
                const classData = vnodeData.className || vnodeData.class;
                if (classData) {
                    vnodeData.class =
                        typeof classData !== 'object'
                            ? classData
                            : Object.keys(classData)
                                .filter((k) => classData[k])
                                .join(' ');
                }
            }
        }
        if (typeof nodeName === 'function') {
            // nodeName is a functional component
            return nodeName(vnodeData === null ? {} : vnodeData, vNodeChildren, vdomFnUtils);
        }
        const vnode = newVNode(nodeName, null);
        vnode.$attrs$ = vnodeData;
        if (vNodeChildren.length > 0) {
            vnode.$children$ = vNodeChildren;
        }
        {
            vnode.$key$ = key;
        }
        {
            vnode.$name$ = slotName;
        }
        return vnode;
    };
    /**
     * A utility function for creating a virtual DOM node from a tag and some
     * possible text content.
     *
     * @param tag the tag for this element
     * @param text possible text content for the node
     * @returns a newly-minted virtual DOM node
     */
    const newVNode = (tag, text) => {
        const vnode = {
            $flags$: 0,
            $tag$: tag,
            $text$: text,
            $elm$: null,
            $children$: null,
        };
        {
            vnode.$attrs$ = null;
        }
        {
            vnode.$key$ = null;
        }
        {
            vnode.$name$ = null;
        }
        return vnode;
    };
    const Host = {};
    /**
     * Check whether a given node is a Host node or not
     *
     * @param node the virtual DOM node to check
     * @returns whether it's a Host node or not
     */
    const isHost = (node) => node && node.$tag$ === Host;
    /**
     * Implementation of {@link d.FunctionalUtilities} for Stencil's VDom.
     *
     * Note that these functions convert from {@link d.VNode} to
     * {@link d.ChildNode} to give functional component developers a friendly
     * interface.
     */
    const vdomFnUtils = {
        forEach: (children, cb) => children.map(convertToPublic).forEach(cb),
        map: (children, cb) => children.map(convertToPublic).map(cb).map(convertToPrivate),
    };
    /**
     * Convert a {@link d.VNode} to a {@link d.ChildNode} in order to present a
     * friendlier public interface (hence, 'convertToPublic').
     *
     * @param node the virtual DOM node to convert
     * @returns a converted child node
     */
    const convertToPublic = (node) => ({
        vattrs: node.$attrs$,
        vchildren: node.$children$,
        vkey: node.$key$,
        vname: node.$name$,
        vtag: node.$tag$,
        vtext: node.$text$,
    });
    /**
     * Convert a {@link d.ChildNode} back to an equivalent {@link d.VNode} in
     * order to use the resulting object in the virtual DOM. The initial object was
     * likely created as part of presenting a public API, so converting it back
     * involved making it 'private' again (hence, `convertToPrivate`).
     *
     * @param node the child node to convert
     * @returns a converted virtual DOM node
     */
    const convertToPrivate = (node) => {
        if (typeof node.vtag === 'function') {
            const vnodeData = Object.assign({}, node.vattrs);
            if (node.vkey) {
                vnodeData.key = node.vkey;
            }
            if (node.vname) {
                vnodeData.name = node.vname;
            }
            return h(node.vtag, vnodeData, ...(node.vchildren || []));
        }
        const vnode = newVNode(node.vtag, node.vtext);
        vnode.$attrs$ = node.vattrs;
        vnode.$children$ = node.vchildren;
        vnode.$key$ = node.vkey;
        vnode.$name$ = node.vname;
        return vnode;
    };
    // Private
    const computeMode = (elm) => modeResolutionChain.map((h) => h(elm)).find((m) => !!m);
    /**
     * Parse a new property value for a given property type.
     *
     * While the prop value can reasonably be expected to be of `any` type as far as TypeScript's type checker is concerned,
     * it is not safe to assume that the string returned by evaluating `typeof propValue` matches:
     *   1. `any`, the type given to `propValue` in the function signature
     *   2. the type stored from `propType`.
     *
     * This function provides the capability to parse/coerce a property's value to potentially any other JavaScript type.
     *
     * Property values represented in TSX preserve their type information. In the example below, the number 0 is passed to
     * a component. This `propValue` will preserve its type information (`typeof propValue === 'number'`). Note that is
     * based on the type of the value being passed in, not the type declared of the class member decorated with `@Prop`.
     * ```tsx
     * <my-cmp prop-val={0}></my-cmp>
     * ```
     *
     * HTML prop values on the other hand, will always a string
     *
     * @param propValue the new value to coerce to some type
     * @param propType the type of the prop, expressed as a binary number
     * @returns the parsed/coerced value
     */
    const parsePropertyValue = (propValue, propType) => {
        // ensure this value is of the correct prop type
        if (propValue != null && !isComplexType(propValue)) {
            if (propType & 4 /* MEMBER_FLAGS.Boolean */) {
                // per the HTML spec, any string value means it is a boolean true value
                // but we'll cheat here and say that the string "false" is the boolean false
                return propValue === 'false' ? false : propValue === '' || !!propValue;
            }
            if (propType & 2 /* MEMBER_FLAGS.Number */) {
                // force it to be a number
                return parseFloat(propValue);
            }
            if (propType & 1 /* MEMBER_FLAGS.String */) {
                // could have been passed as a number or boolean
                // but we still want it as a string
                return String(propValue);
            }
            // redundant return here for better minification
            return propValue;
        }
        // not sure exactly what type we want
        // so no need to change to a different type
        return propValue;
    };
    const getElement = (ref) => (ref);
    const createEvent = (ref, name, flags) => {
        const elm = getElement(ref);
        return {
            emit: (detail) => {
                return emitEvent(elm, name, {
                    bubbles: !!(flags & 4 /* EVENT_FLAGS.Bubbles */),
                    composed: !!(flags & 2 /* EVENT_FLAGS.Composed */),
                    cancelable: !!(flags & 1 /* EVENT_FLAGS.Cancellable */),
                    detail,
                });
            },
        };
    };
    /**
     * Helper function to create & dispatch a custom Event on a provided target
     * @param elm the target of the Event
     * @param name the name to give the custom Event
     * @param opts options for configuring a custom Event
     * @returns the custom Event
     */
    const emitEvent = (elm, name, opts) => {
        const ev = plt.ce(name, opts);
        elm.dispatchEvent(ev);
        return ev;
    };
    const rootAppliedStyles = /*@__PURE__*/ new WeakMap();
    const registerStyle = (scopeId, cssText, allowCS) => {
        let style = styles.get(scopeId);
        if (supportsConstructableStylesheets && allowCS) {
            style = (style || new CSSStyleSheet());
            if (typeof style === 'string') {
                style = cssText;
            }
            else {
                style.replaceSync(cssText);
            }
        }
        else {
            style = cssText;
        }
        styles.set(scopeId, style);
    };
    const addStyle = (styleContainerNode, cmpMeta, mode) => {
        var _a;
        const scopeId = getScopeId(cmpMeta, mode);
        const style = styles.get(scopeId);
        // if an element is NOT connected then getRootNode() will return the wrong root node
        // so the fallback is to always use the document for the root node in those cases
        styleContainerNode = styleContainerNode.nodeType === 11 /* NODE_TYPE.DocumentFragment */ ? styleContainerNode : doc;
        if (style) {
            if (typeof style === 'string') {
                styleContainerNode = styleContainerNode.head || styleContainerNode;
                let appliedStyles = rootAppliedStyles.get(styleContainerNode);
                let styleElm;
                if (!appliedStyles) {
                    rootAppliedStyles.set(styleContainerNode, (appliedStyles = new Set()));
                }
                if (!appliedStyles.has(scopeId)) {
                    {
                        styleElm = doc.createElement('style');
                        styleElm.innerHTML = style;
                        // Apply CSP nonce to the style tag if it exists
                        const nonce = (_a = plt.$nonce$) !== null && _a !== void 0 ? _a : queryNonceMetaTagContent(doc);
                        if (nonce != null) {
                            styleElm.setAttribute('nonce', nonce);
                        }
                        styleContainerNode.insertBefore(styleElm, styleContainerNode.querySelector('link'));
                    }
                    // Add styles for `slot-fb` elements if we're using slots outside the Shadow DOM
                    if (cmpMeta.$flags$ & 4 /* CMP_FLAGS.hasSlotRelocation */) {
                        styleElm.innerHTML += SLOT_FB_CSS;
                    }
                    if (appliedStyles) {
                        appliedStyles.add(scopeId);
                    }
                }
            }
            else if (!styleContainerNode.adoptedStyleSheets.includes(style)) {
                styleContainerNode.adoptedStyleSheets = [...styleContainerNode.adoptedStyleSheets, style];
            }
        }
        return scopeId;
    };
    const attachStyles = (hostRef) => {
        const cmpMeta = hostRef.$cmpMeta$;
        const elm = hostRef.$hostElement$;
        const flags = cmpMeta.$flags$;
        const endAttachStyles = createTime('attachStyles', cmpMeta.$tagName$);
        const scopeId = addStyle(elm.shadowRoot ? elm.shadowRoot : elm.getRootNode(), cmpMeta, hostRef.$modeName$);
        if (flags & 10 /* CMP_FLAGS.needsScopedEncapsulation */) {
            // only required when we're NOT using native shadow dom (slot)
            // or this browser doesn't support native shadow dom
            // and this host element was NOT created with SSR
            // let's pick out the inner content for slot projection
            // create a node to represent where the original
            // content was first placed, which is useful later on
            // DOM WRITE!!
            elm['s-sc'] = scopeId;
            elm.classList.add(scopeId + '-h');
            if (flags & 2 /* CMP_FLAGS.scopedCssEncapsulation */) {
                elm.classList.add(scopeId + '-s');
            }
        }
        endAttachStyles();
    };
    const getScopeId = (cmp, mode) => 'sc-' + (mode && cmp.$flags$ & 32 /* CMP_FLAGS.hasMode */ ? cmp.$tagName$ + '-' + mode : cmp.$tagName$);
    /**
     * Production setAccessor() function based on Preact by
     * Jason Miller (@developit)
     * Licensed under the MIT License
     * https://github.com/developit/preact/blob/master/LICENSE
     *
     * Modified for Stencil's compiler and vdom
     */
    /**
     * When running a VDom render set properties present on a VDom node onto the
     * corresponding HTML element.
     *
     * Note that this function has special functionality for the `class`,
     * `style`, `key`, and `ref` attributes, as well as event handlers (like
     * `onClick`, etc). All others are just passed through as-is.
     *
     * @param elm the HTMLElement onto which attributes should be set
     * @param memberName the name of the attribute to set
     * @param oldValue the old value for the attribute
     * @param newValue the new value for the attribute
     * @param isSvg whether we're in an svg context or not
     * @param flags bitflags for Vdom variables
     */
    const setAccessor = (elm, memberName, oldValue, newValue, isSvg, flags) => {
        if (oldValue !== newValue) {
            let isProp = isMemberInElement(elm, memberName);
            let ln = memberName.toLowerCase();
            if (memberName === 'class') {
                const classList = elm.classList;
                const oldClasses = parseClassList(oldValue);
                const newClasses = parseClassList(newValue);
                classList.remove(...oldClasses.filter((c) => c && !newClasses.includes(c)));
                classList.add(...newClasses.filter((c) => c && !oldClasses.includes(c)));
            }
            else if (memberName === 'style') {
                // update style attribute, css properties and values
                {
                    for (const prop in oldValue) {
                        if (!newValue || newValue[prop] == null) {
                            if (prop.includes('-')) {
                                elm.style.removeProperty(prop);
                            }
                            else {
                                elm.style[prop] = '';
                            }
                        }
                    }
                }
                for (const prop in newValue) {
                    if (!oldValue || newValue[prop] !== oldValue[prop]) {
                        if (prop.includes('-')) {
                            elm.style.setProperty(prop, newValue[prop]);
                        }
                        else {
                            elm.style[prop] = newValue[prop];
                        }
                    }
                }
            }
            else if (memberName === 'key')
                ;
            else if (memberName === 'ref') {
                // minifier will clean this up
                if (newValue) {
                    newValue(elm);
                }
            }
            else if ((!elm.__lookupSetter__(memberName)) &&
                memberName[0] === 'o' &&
                memberName[1] === 'n') {
                // Event Handlers
                // so if the member name starts with "on" and the 3rd characters is
                // a capital letter, and it's not already a member on the element,
                // then we're assuming it's an event listener
                if (memberName[2] === '-') {
                    // on- prefixed events
                    // allows to be explicit about the dom event to listen without any magic
                    // under the hood:
                    // <my-cmp on-click> // listens for "click"
                    // <my-cmp on-Click> // listens for "Click"
                    // <my-cmp on-ionChange> // listens for "ionChange"
                    // <my-cmp on-EVENTS> // listens for "EVENTS"
                    memberName = memberName.slice(3);
                }
                else if (isMemberInElement(win, ln)) {
                    // standard event
                    // the JSX attribute could have been "onMouseOver" and the
                    // member name "onmouseover" is on the window's prototype
                    // so let's add the listener "mouseover", which is all lowercased
                    memberName = ln.slice(2);
                }
                else {
                    // custom event
                    // the JSX attribute could have been "onMyCustomEvent"
                    // so let's trim off the "on" prefix and lowercase the first character
                    // and add the listener "myCustomEvent"
                    // except for the first character, we keep the event name case
                    memberName = ln[2] + memberName.slice(3);
                }
                if (oldValue || newValue) {
                    // Need to account for "capture" events.
                    // If the event name ends with "Capture", we'll update the name to remove
                    // the "Capture" suffix and make sure the event listener is setup to handle the capture event.
                    const capture = memberName.endsWith(CAPTURE_EVENT_SUFFIX);
                    // Make sure we only replace the last instance of "Capture"
                    memberName = memberName.replace(CAPTURE_EVENT_REGEX, '');
                    if (oldValue) {
                        plt.rel(elm, memberName, oldValue, capture);
                    }
                    if (newValue) {
                        plt.ael(elm, memberName, newValue, capture);
                    }
                }
            }
            else {
                // Set property if it exists and it's not a SVG
                const isComplex = isComplexType(newValue);
                if ((isProp || (isComplex && newValue !== null)) && !isSvg) {
                    try {
                        if (!elm.tagName.includes('-')) {
                            const n = newValue == null ? '' : newValue;
                            // Workaround for Safari, moving the <input> caret when re-assigning the same valued
                            if (memberName === 'list') {
                                isProp = false;
                            }
                            else if (oldValue == null || elm[memberName] != n) {
                                elm[memberName] = n;
                            }
                        }
                        else {
                            elm[memberName] = newValue;
                        }
                    }
                    catch (e) {
                        /**
                         * in case someone tries to set a read-only property, e.g. "namespaceURI", we just ignore it
                         */
                    }
                }
                /**
                 * Need to manually update attribute if:
                 * - memberName is not an attribute
                 * - if we are rendering the host element in order to reflect attribute
                 * - if it's a SVG, since properties might not work in <svg>
                 * - if the newValue is null/undefined or 'false'.
                 */
                let xlink = false;
                {
                    if (ln !== (ln = ln.replace(/^xlink\:?/, ''))) {
                        memberName = ln;
                        xlink = true;
                    }
                }
                if (newValue == null || newValue === false) {
                    if (newValue !== false || elm.getAttribute(memberName) === '') {
                        if (xlink) {
                            elm.removeAttributeNS(XLINK_NS, memberName);
                        }
                        else {
                            elm.removeAttribute(memberName);
                        }
                    }
                }
                else if ((!isProp || flags & 4 /* VNODE_FLAGS.isHost */ || isSvg) && !isComplex) {
                    newValue = newValue === true ? '' : newValue;
                    if (xlink) {
                        elm.setAttributeNS(XLINK_NS, memberName, newValue);
                    }
                    else {
                        elm.setAttribute(memberName, newValue);
                    }
                }
            }
        }
    };
    const parseClassListRegex = /\s/;
    /**
     * Parsed a string of classnames into an array
     * @param value className string, e.g. "foo bar baz"
     * @returns list of classes, e.g. ["foo", "bar", "baz"]
     */
    const parseClassList = (value) => (!value ? [] : value.split(parseClassListRegex));
    const CAPTURE_EVENT_SUFFIX = 'Capture';
    const CAPTURE_EVENT_REGEX = new RegExp(CAPTURE_EVENT_SUFFIX + '$');
    const updateElement = (oldVnode, newVnode, isSvgMode, memberName) => {
        // if the element passed in is a shadow root, which is a document fragment
        // then we want to be adding attrs/props to the shadow root's "host" element
        // if it's not a shadow root, then we add attrs/props to the same element
        const elm = newVnode.$elm$.nodeType === 11 /* NODE_TYPE.DocumentFragment */ && newVnode.$elm$.host
            ? newVnode.$elm$.host
            : newVnode.$elm$;
        const oldVnodeAttrs = (oldVnode && oldVnode.$attrs$) || EMPTY_OBJ;
        const newVnodeAttrs = newVnode.$attrs$ || EMPTY_OBJ;
        {
            // remove attributes no longer present on the vnode by setting them to undefined
            for (memberName in oldVnodeAttrs) {
                if (!(memberName in newVnodeAttrs)) {
                    setAccessor(elm, memberName, oldVnodeAttrs[memberName], undefined, isSvgMode, newVnode.$flags$);
                }
            }
        }
        // add new & update changed attributes
        for (memberName in newVnodeAttrs) {
            setAccessor(elm, memberName, oldVnodeAttrs[memberName], newVnodeAttrs[memberName], isSvgMode, newVnode.$flags$);
        }
    };
    /**
     * Create a DOM Node corresponding to one of the children of a given VNode.
     *
     * @param oldParentVNode the parent VNode from the previous render
     * @param newParentVNode the parent VNode from the current render
     * @param childIndex the index of the VNode, in the _new_ parent node's
     * children, for which we will create a new DOM node
     * @param parentElm the parent DOM node which our new node will be a child of
     * @returns the newly created node
     */
    const createElm = (oldParentVNode, newParentVNode, childIndex, parentElm) => {
        // tslint:disable-next-line: prefer-const
        const newVNode = newParentVNode.$children$[childIndex];
        let i = 0;
        let elm;
        let childNode;
        let oldVNode;
        if (!useNativeShadowDom) {
            // remember for later we need to check to relocate nodes
            checkSlotRelocate = true;
            if (newVNode.$tag$ === 'slot') {
                if (scopeId) {
                    // scoped css needs to add its scoped id to the parent element
                    parentElm.classList.add(scopeId + '-s');
                }
                newVNode.$flags$ |= newVNode.$children$
                    ? // slot element has fallback content
                        2 /* VNODE_FLAGS.isSlotFallback */
                    : // slot element does not have fallback content
                        1 /* VNODE_FLAGS.isSlotReference */;
            }
        }
        if (newVNode.$text$ !== null) {
            // create text node
            elm = newVNode.$elm$ = doc.createTextNode(newVNode.$text$);
        }
        else if (newVNode.$flags$ & 1 /* VNODE_FLAGS.isSlotReference */) {
            // create a slot reference node
            elm = newVNode.$elm$ =
                doc.createTextNode('');
        }
        else {
            if (!isSvgMode) {
                isSvgMode = newVNode.$tag$ === 'svg';
            }
            // create element
            elm = newVNode.$elm$ = (doc.createElementNS(isSvgMode ? SVG_NS : HTML_NS, newVNode.$flags$ & 2 /* VNODE_FLAGS.isSlotFallback */
                    ? 'slot-fb'
                    : newVNode.$tag$)
                );
            if (isSvgMode && newVNode.$tag$ === 'foreignObject') {
                isSvgMode = false;
            }
            // add css classes, attrs, props, listeners, etc.
            {
                updateElement(null, newVNode, isSvgMode);
            }
            if (isDef(scopeId) && elm['s-si'] !== scopeId) {
                // if there is a scopeId and this is the initial render
                // then let's add the scopeId as a css class
                elm.classList.add((elm['s-si'] = scopeId));
            }
            if (newVNode.$children$) {
                for (i = 0; i < newVNode.$children$.length; ++i) {
                    // create the node
                    childNode = createElm(oldParentVNode, newVNode, i, elm);
                    // return node could have been null
                    if (childNode) {
                        // append our new node
                        elm.appendChild(childNode);
                    }
                }
            }
            {
                if (newVNode.$tag$ === 'svg') {
                    // Only reset the SVG context when we're exiting <svg> element
                    isSvgMode = false;
                }
                else if (elm.tagName === 'foreignObject') {
                    // Reenter SVG context when we're exiting <foreignObject> element
                    isSvgMode = true;
                }
            }
        }
        // This needs to always happen so we can hide nodes that are projected
        // to another component but don't end up in a slot
        elm['s-hn'] = hostTagName;
        {
            if (newVNode.$flags$ & (2 /* VNODE_FLAGS.isSlotFallback */ | 1 /* VNODE_FLAGS.isSlotReference */)) {
                // remember the content reference comment
                elm['s-sr'] = true;
                // remember the content reference comment
                elm['s-cr'] = contentRef;
                // remember the slot name, or empty string for default slot
                elm['s-sn'] = newVNode.$name$ || '';
                // check if we've got an old vnode for this slot
                oldVNode = oldParentVNode && oldParentVNode.$children$ && oldParentVNode.$children$[childIndex];
                if (oldVNode && oldVNode.$tag$ === newVNode.$tag$ && oldParentVNode.$elm$) {
                    {
                        // we've got an old slot vnode and the wrapper is being replaced
                        // so let's move the old slot content back to its original location
                        putBackInOriginalLocation(oldParentVNode.$elm$, false);
                    }
                }
            }
        }
        return elm;
    };
    const putBackInOriginalLocation = (parentElm, recursive) => {
        plt.$flags$ |= 1 /* PLATFORM_FLAGS.isTmpDisconnected */;
        const oldSlotChildNodes = parentElm.childNodes;
        for (let i = oldSlotChildNodes.length - 1; i >= 0; i--) {
            const childNode = oldSlotChildNodes[i];
            if (childNode['s-hn'] !== hostTagName && childNode['s-ol']) {
                // and relocate it back to it's original location
                parentReferenceNode(childNode).insertBefore(childNode, referenceNode(childNode));
                // remove the old original location comment entirely
                // later on the patch function will know what to do
                // and move this to the correct spot if need be
                childNode['s-ol'].remove();
                childNode['s-ol'] = undefined;
                // Reset so we can correctly move the node around again.
                childNode['s-sh'] = undefined;
                checkSlotRelocate = true;
            }
            if (recursive) {
                putBackInOriginalLocation(childNode, recursive);
            }
        }
        plt.$flags$ &= ~1 /* PLATFORM_FLAGS.isTmpDisconnected */;
    };
    /**
     * Create DOM nodes corresponding to a list of {@link d.Vnode} objects and
     * add them to the DOM in the appropriate place.
     *
     * @param parentElm the DOM node which should be used as a parent for the new
     * DOM nodes
     * @param before a child of the `parentElm` which the new children should be
     * inserted before (optional)
     * @param parentVNode the parent virtual DOM node
     * @param vnodes the new child virtual DOM nodes to produce DOM nodes for
     * @param startIdx the index in the child virtual DOM nodes at which to start
     * creating DOM nodes (inclusive)
     * @param endIdx the index in the child virtual DOM nodes at which to stop
     * creating DOM nodes (inclusive)
     */
    const addVnodes = (parentElm, before, parentVNode, vnodes, startIdx, endIdx) => {
        let containerElm = ((parentElm['s-cr'] && parentElm['s-cr'].parentNode) || parentElm);
        let childNode;
        if (containerElm.shadowRoot && containerElm.tagName === hostTagName) {
            containerElm = containerElm.shadowRoot;
        }
        for (; startIdx <= endIdx; ++startIdx) {
            if (vnodes[startIdx]) {
                childNode = createElm(null, parentVNode, startIdx, parentElm);
                if (childNode) {
                    vnodes[startIdx].$elm$ = childNode;
                    containerElm.insertBefore(childNode, referenceNode(before) );
                }
            }
        }
    };
    /**
     * Remove the DOM elements corresponding to a list of {@link d.VNode} objects.
     * This can be used to, for instance, clean up after a list of children which
     * should no longer be shown.
     *
     * This function also handles some of Stencil's slot relocation logic.
     *
     * @param vnodes a list of virtual DOM nodes to remove
     * @param startIdx the index at which to start removing nodes (inclusive)
     * @param endIdx the index at which to stop removing nodes (inclusive)
     */
    const removeVnodes = (vnodes, startIdx, endIdx) => {
        for (let index = startIdx; index <= endIdx; ++index) {
            const vnode = vnodes[index];
            if (vnode) {
                const elm = vnode.$elm$;
                nullifyVNodeRefs(vnode);
                if (elm) {
                    {
                        // we're removing this element
                        // so it's possible we need to show slot fallback content now
                        checkSlotFallbackVisibility = true;
                        if (elm['s-ol']) {
                            // remove the original location comment
                            elm['s-ol'].remove();
                        }
                        else {
                            // it's possible that child nodes of the node
                            // that's being removed are slot nodes
                            putBackInOriginalLocation(elm, true);
                        }
                    }
                    // remove the vnode's element from the dom
                    elm.remove();
                }
            }
        }
    };
    /**
     * Reconcile the children of a new VNode with the children of an old VNode by
     * traversing the two collections of children, identifying nodes that are
     * conserved or changed, calling out to `patch` to make any necessary
     * updates to the DOM, and rearranging DOM nodes as needed.
     *
     * The algorithm for reconciling children works by analyzing two 'windows' onto
     * the two arrays of children (`oldCh` and `newCh`). We keep track of the
     * 'windows' by storing start and end indices and references to the
     * corresponding array entries. Initially the two 'windows' are basically equal
     * to the entire array, but we progressively narrow the windows until there are
     * no children left to update by doing the following:
     *
     * 1. Skip any `null` entries at the beginning or end of the two arrays, so
     *    that if we have an initial array like the following we'll end up dealing
     *    only with a window bounded by the highlighted elements:
     *
     *    [null, null, VNode1 , ... , VNode2, null, null]
     *                 ^^^^^^         ^^^^^^
     *
     * 2. Check to see if the elements at the head and tail positions are equal
     *    across the windows. This will basically detect elements which haven't
     *    been added, removed, or changed position, i.e. if you had the following
     *    VNode elements (represented as HTML):
     *
     *    oldVNode: `<div><p><span>HEY</span></p></div>`
     *    newVNode: `<div><p><span>THERE</span></p></div>`
     *
     *    Then when comparing the children of the `<div>` tag we check the equality
     *    of the VNodes corresponding to the `<p>` tags and, since they are the
     *    same tag in the same position, we'd be able to avoid completely
     *    re-rendering the subtree under them with a new DOM element and would just
     *    call out to `patch` to handle reconciling their children and so on.
     *
     * 3. Check, for both windows, to see if the element at the beginning of the
     *    window corresponds to the element at the end of the other window. This is
     *    a heuristic which will let us identify _some_ situations in which
     *    elements have changed position, for instance it _should_ detect that the
     *    children nodes themselves have not changed but merely moved in the
     *    following example:
     *
     *    oldVNode: `<div><element-one /><element-two /></div>`
     *    newVNode: `<div><element-two /><element-one /></div>`
     *
     *    If we find cases like this then we also need to move the concrete DOM
     *    elements corresponding to the moved children to write the re-order to the
     *    DOM.
     *
     * 4. Finally, if VNodes have the `key` attribute set on them we check for any
     *    nodes in the old children which have the same key as the first element in
     *    our window on the new children. If we find such a node we handle calling
     *    out to `patch`, moving relevant DOM nodes, and so on, in accordance with
     *    what we find.
     *
     * Finally, once we've narrowed our 'windows' to the point that either of them
     * collapse (i.e. they have length 0) we then handle any remaining VNode
     * insertion or deletion that needs to happen to get a DOM state that correctly
     * reflects the new child VNodes. If, for instance, after our window on the old
     * children has collapsed we still have more nodes on the new children that
     * we haven't dealt with yet then we need to add them, or if the new children
     * collapse but we still have unhandled _old_ children then we need to make
     * sure the corresponding DOM nodes are removed.
     *
     * @param parentElm the node into which the parent VNode is rendered
     * @param oldCh the old children of the parent node
     * @param newVNode the new VNode which will replace the parent
     * @param newCh the new children of the parent node
     * @param isInitialRender whether or not this is the first render of the vdom
     */
    const updateChildren = (parentElm, oldCh, newVNode, newCh, isInitialRender = false) => {
        let oldStartIdx = 0;
        let newStartIdx = 0;
        let idxInOld = 0;
        let i = 0;
        let oldEndIdx = oldCh.length - 1;
        let oldStartVnode = oldCh[0];
        let oldEndVnode = oldCh[oldEndIdx];
        let newEndIdx = newCh.length - 1;
        let newStartVnode = newCh[0];
        let newEndVnode = newCh[newEndIdx];
        let node;
        let elmToMove;
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (oldStartVnode == null) {
                // VNode might have been moved left
                oldStartVnode = oldCh[++oldStartIdx];
            }
            else if (oldEndVnode == null) {
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (newStartVnode == null) {
                newStartVnode = newCh[++newStartIdx];
            }
            else if (newEndVnode == null) {
                newEndVnode = newCh[--newEndIdx];
            }
            else if (isSameVnode(oldStartVnode, newStartVnode, isInitialRender)) {
                // if the start nodes are the same then we should patch the new VNode
                // onto the old one, and increment our `newStartIdx` and `oldStartIdx`
                // indices to reflect that. We don't need to move any DOM Nodes around
                // since things are matched up in order.
                patch(oldStartVnode, newStartVnode, isInitialRender);
                oldStartVnode = oldCh[++oldStartIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else if (isSameVnode(oldEndVnode, newEndVnode, isInitialRender)) {
                // likewise, if the end nodes are the same we patch new onto old and
                // decrement our end indices, and also likewise in this case we don't
                // need to move any DOM Nodes.
                patch(oldEndVnode, newEndVnode, isInitialRender);
                oldEndVnode = oldCh[--oldEndIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (isSameVnode(oldStartVnode, newEndVnode, isInitialRender)) {
                // case: "Vnode moved right"
                //
                // We've found that the last node in our window on the new children is
                // the same VNode as the _first_ node in our window on the old children
                // we're dealing with now. Visually, this is the layout of these two
                // nodes:
                //
                // newCh: [..., newStartVnode , ... , newEndVnode , ...]
                //                                    ^^^^^^^^^^^
                // oldCh: [..., oldStartVnode , ... , oldEndVnode , ...]
                //              ^^^^^^^^^^^^^
                //
                // In this situation we need to patch `newEndVnode` onto `oldStartVnode`
                // and move the DOM element for `oldStartVnode`.
                if ((oldStartVnode.$tag$ === 'slot' || newEndVnode.$tag$ === 'slot')) {
                    putBackInOriginalLocation(oldStartVnode.$elm$.parentNode, false);
                }
                patch(oldStartVnode, newEndVnode, isInitialRender);
                // We need to move the element for `oldStartVnode` into a position which
                // will be appropriate for `newEndVnode`. For this we can use
                // `.insertBefore` and `oldEndVnode.$elm$.nextSibling`. If there is a
                // sibling for `oldEndVnode.$elm$` then we want to move the DOM node for
                // `oldStartVnode` between `oldEndVnode` and it's sibling, like so:
                //
                // <old-start-node />
                // <some-intervening-node />
                // <old-end-node />
                // <!-- ->              <-- `oldStartVnode.$elm$` should be inserted here
                // <next-sibling />
                //
                // If instead `oldEndVnode.$elm$` has no sibling then we just want to put
                // the node for `oldStartVnode` at the end of the children of
                // `parentElm`. Luckily, `Node.nextSibling` will return `null` if there
                // aren't any siblings, and passing `null` to `Node.insertBefore` will
                // append it to the children of the parent element.
                parentElm.insertBefore(oldStartVnode.$elm$, oldEndVnode.$elm$.nextSibling);
                oldStartVnode = oldCh[++oldStartIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (isSameVnode(oldEndVnode, newStartVnode, isInitialRender)) {
                // case: "Vnode moved left"
                //
                // We've found that the first node in our window on the new children is
                // the same VNode as the _last_ node in our window on the old children.
                // Visually, this is the layout of these two nodes:
                //
                // newCh: [..., newStartVnode , ... , newEndVnode , ...]
                //              ^^^^^^^^^^^^^
                // oldCh: [..., oldStartVnode , ... , oldEndVnode , ...]
                //                                    ^^^^^^^^^^^
                //
                // In this situation we need to patch `newStartVnode` onto `oldEndVnode`
                // (which will handle updating any changed attributes, reconciling their
                // children etc) but we also need to move the DOM node to which
                // `oldEndVnode` corresponds.
                if ((oldStartVnode.$tag$ === 'slot' || newEndVnode.$tag$ === 'slot')) {
                    putBackInOriginalLocation(oldEndVnode.$elm$.parentNode, false);
                }
                patch(oldEndVnode, newStartVnode, isInitialRender);
                // We've already checked above if `oldStartVnode` and `newStartVnode` are
                // the same node, so since we're here we know that they are not. Thus we
                // can move the element for `oldEndVnode` _before_ the element for
                // `oldStartVnode`, leaving `oldStartVnode` to be reconciled in the
                // future.
                parentElm.insertBefore(oldEndVnode.$elm$, oldStartVnode.$elm$);
                oldEndVnode = oldCh[--oldEndIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else {
                // Here we do some checks to match up old and new nodes based on the
                // `$key$` attribute, which is set by putting a `key="my-key"` attribute
                // in the JSX for a DOM element in the implementation of a Stencil
                // component.
                //
                // First we check to see if there are any nodes in the array of old
                // children which have the same key as the first node in the new
                // children.
                idxInOld = -1;
                {
                    for (i = oldStartIdx; i <= oldEndIdx; ++i) {
                        if (oldCh[i] && oldCh[i].$key$ !== null && oldCh[i].$key$ === newStartVnode.$key$) {
                            idxInOld = i;
                            break;
                        }
                    }
                }
                if (idxInOld >= 0) {
                    // We found a node in the old children which matches up with the first
                    // node in the new children! So let's deal with that
                    elmToMove = oldCh[idxInOld];
                    if (elmToMove.$tag$ !== newStartVnode.$tag$) {
                        // the tag doesn't match so we'll need a new DOM element
                        node = createElm(oldCh && oldCh[newStartIdx], newVNode, idxInOld, parentElm);
                    }
                    else {
                        patch(elmToMove, newStartVnode, isInitialRender);
                        // invalidate the matching old node so that we won't try to update it
                        // again later on
                        oldCh[idxInOld] = undefined;
                        node = elmToMove.$elm$;
                    }
                    newStartVnode = newCh[++newStartIdx];
                }
                else {
                    // We either didn't find an element in the old children that matches
                    // the key of the first new child OR the build is not using `key`
                    // attributes at all. In either case we need to create a new element
                    // for the new node.
                    node = createElm(oldCh && oldCh[newStartIdx], newVNode, newStartIdx, parentElm);
                    newStartVnode = newCh[++newStartIdx];
                }
                if (node) {
                    // if we created a new node then handle inserting it to the DOM
                    {
                        parentReferenceNode(oldStartVnode.$elm$).insertBefore(node, referenceNode(oldStartVnode.$elm$));
                    }
                }
            }
        }
        if (oldStartIdx > oldEndIdx) {
            // we have some more new nodes to add which don't match up with old nodes
            addVnodes(parentElm, newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].$elm$, newVNode, newCh, newStartIdx, newEndIdx);
        }
        else if (newStartIdx > newEndIdx) {
            // there are nodes in the `oldCh` array which no longer correspond to nodes
            // in the new array, so lets remove them (which entails cleaning up the
            // relevant DOM nodes)
            removeVnodes(oldCh, oldStartIdx, oldEndIdx);
        }
    };
    /**
     * Compare two VNodes to determine if they are the same
     *
     * **NB**: This function is an equality _heuristic_ based on the available
     * information set on the two VNodes and can be misleading under certain
     * circumstances. In particular, if the two nodes do not have `key` attrs
     * (available under `$key$` on VNodes) then the function falls back on merely
     * checking that they have the same tag.
     *
     * So, in other words, if `key` attrs are not set on VNodes which may be
     * changing order within a `children` array or something along those lines then
     * we could obtain a false negative and then have to do needless re-rendering
     * (i.e. we'd say two VNodes aren't equal when in fact they should be).
     *
     * @param leftVNode the first VNode to check
     * @param rightVNode the second VNode to check
     * @param isInitialRender whether or not this is the first render of the vdom
     * @returns whether they're equal or not
     */
    const isSameVnode = (leftVNode, rightVNode, isInitialRender = false) => {
        // compare if two vnode to see if they're "technically" the same
        // need to have the same element tag, and same key to be the same
        if (leftVNode.$tag$ === rightVNode.$tag$) {
            if (leftVNode.$tag$ === 'slot') {
                return leftVNode.$name$ === rightVNode.$name$;
            }
            // this will be set if JSX tags in the build have `key` attrs set on them
            // we only want to check this if we're not on the first render since on
            // first render `leftVNode.$key$` will always be `null`, so we can be led
            // astray and, for instance, accidentally delete a DOM node that we want to
            // keep around.
            if (!isInitialRender) {
                return leftVNode.$key$ === rightVNode.$key$;
            }
            return true;
        }
        return false;
    };
    const referenceNode = (node) => {
        // this node was relocated to a new location in the dom
        // because of some other component's slot
        // but we still have an html comment in place of where
        // it's original location was according to it's original vdom
        return (node && node['s-ol']) || node;
    };
    const parentReferenceNode = (node) => (node['s-ol'] ? node['s-ol'] : node).parentNode;
    /**
     * Handle reconciling an outdated VNode with a new one which corresponds to
     * it. This function handles flushing updates to the DOM and reconciling the
     * children of the two nodes (if any).
     *
     * @param oldVNode an old VNode whose DOM element and children we want to update
     * @param newVNode a new VNode representing an updated version of the old one
     * @param isInitialRender whether or not this is the first render of the vdom
     */
    const patch = (oldVNode, newVNode, isInitialRender = false) => {
        const elm = (newVNode.$elm$ = oldVNode.$elm$);
        const oldChildren = oldVNode.$children$;
        const newChildren = newVNode.$children$;
        const tag = newVNode.$tag$;
        const text = newVNode.$text$;
        let defaultHolder;
        if (text === null) {
            {
                // test if we're rendering an svg element, or still rendering nodes inside of one
                // only add this to the when the compiler sees we're using an svg somewhere
                isSvgMode = tag === 'svg' ? true : tag === 'foreignObject' ? false : isSvgMode;
            }
            {
                if (tag === 'slot')
                    ;
                else {
                    // either this is the first render of an element OR it's an update
                    // AND we already know it's possible it could have changed
                    // this updates the element's css classes, attrs, props, listeners, etc.
                    updateElement(oldVNode, newVNode, isSvgMode);
                }
            }
            if (oldChildren !== null && newChildren !== null) {
                // looks like there's child vnodes for both the old and new vnodes
                // so we need to call `updateChildren` to reconcile them
                updateChildren(elm, oldChildren, newVNode, newChildren, isInitialRender);
            }
            else if (newChildren !== null) {
                // no old child vnodes, but there are new child vnodes to add
                if (oldVNode.$text$ !== null) {
                    // the old vnode was text, so be sure to clear it out
                    elm.textContent = '';
                }
                // add the new vnode children
                addVnodes(elm, null, newVNode, newChildren, 0, newChildren.length - 1);
            }
            else if (oldChildren !== null) {
                // no new child vnodes, but there are old child vnodes to remove
                removeVnodes(oldChildren, 0, oldChildren.length - 1);
            }
            if (isSvgMode && tag === 'svg') {
                isSvgMode = false;
            }
        }
        else if ((defaultHolder = elm['s-cr'])) {
            // this element has slotted content
            defaultHolder.parentNode.textContent = text;
        }
        else if (oldVNode.$text$ !== text) {
            // update the text content for the text only vnode
            // and also only if the text is different than before
            elm.data = text;
        }
    };
    /**
     * Adjust the `.hidden` property as-needed on any nodes in a DOM subtree which
     * are slot fallbacks nodes.
     *
     * A slot fallback node should be visible by default. Then, it should be
     * conditionally hidden if:
     *
     * - it has a sibling with a `slot` property set to its slot name or if
     * - it is a default fallback slot node, in which case we hide if it has any
     *   content
     *
     * @param elm the element of interest
     */
    const updateFallbackSlotVisibility = (elm) => {
        const childNodes = elm.childNodes;
        for (const childNode of childNodes) {
            if (childNode.nodeType === 1 /* NODE_TYPE.ElementNode */) {
                if (childNode['s-sr']) {
                    // this is a slot fallback node
                    // get the slot name for this slot reference node
                    const slotName = childNode['s-sn'];
                    // by default always show a fallback slot node
                    // then hide it if there are other slots in the light dom
                    childNode.hidden = false;
                    // we need to check all of its sibling nodes in order to see if
                    // `childNode` should be hidden
                    for (const siblingNode of childNodes) {
                        // Don't check the node against itself
                        if (siblingNode !== childNode) {
                            if (siblingNode['s-hn'] !== childNode['s-hn'] || slotName !== '') {
                                // this sibling node is from a different component OR is a named
                                // fallback slot node
                                if (siblingNode.nodeType === 1 /* NODE_TYPE.ElementNode */ &&
                                    (slotName === siblingNode.getAttribute('slot') || slotName === siblingNode['s-sn'])) {
                                    childNode.hidden = true;
                                    break;
                                }
                            }
                            else {
                                // this is a default fallback slot node
                                // any element or text node (with content)
                                // should hide the default fallback slot node
                                if (siblingNode.nodeType === 1 /* NODE_TYPE.ElementNode */ ||
                                    (siblingNode.nodeType === 3 /* NODE_TYPE.TextNode */ && siblingNode.textContent.trim() !== '')) {
                                    childNode.hidden = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                // keep drilling down
                updateFallbackSlotVisibility(childNode);
            }
        }
    };
    /**
     * Component-global information about nodes which are either currently being
     * relocated or will be shortly.
     */
    const relocateNodes = [];
    /**
     * Mark the contents of a slot for relocation via adding references to them to
     * the {@link relocateNodes} data structure. The actual work of relocating them
     * will then be handled in {@link renderVdom}.
     *
     * @param elm a render node whose child nodes need to be relocated
     */
    const markSlotContentForRelocation = (elm) => {
        // tslint:disable-next-line: prefer-const
        let node;
        let hostContentNodes;
        let j;
        for (const childNode of elm.childNodes) {
            // we need to find child nodes which are slot references so we can then try
            // to match them up with nodes that need to be relocated
            if (childNode['s-sr'] && (node = childNode['s-cr']) && node.parentNode) {
                // first get the content reference comment node ('s-cr'), then we get
                // its parent, which is where all the host content is now
                hostContentNodes = node.parentNode.childNodes;
                const slotName = childNode['s-sn'];
                // iterate through all the nodes under the location where the host was
                // originally rendered
                for (j = hostContentNodes.length - 1; j >= 0; j--) {
                    node = hostContentNodes[j];
                    // check that the node is not a content reference node or a node
                    // reference and then check that the host name does not match that of
                    // childNode.
                    // In addition, check that the slot either has not already been relocated, or
                    // that its current location's host is not childNode's host. This is essentially
                    // a check so that we don't try to relocate (and then hide) a node that is already
                    // where it should be.
                    if (!node['s-cn'] &&
                        !node['s-nr'] &&
                        node['s-hn'] !== childNode['s-hn'] &&
                        (!BUILD.experimentalSlotFixes  )) {
                        // if `node` is located in the slot that `childNode` refers to (via the
                        // `'s-sn'` property) then we need to relocate it from it's current spot
                        // (under the host element parent) to the right slot location
                        if (isNodeLocatedInSlot(node, slotName)) {
                            // it's possible we've already decided to relocate this node
                            let relocateNodeData = relocateNodes.find((r) => r.$nodeToRelocate$ === node);
                            // made some changes to slots
                            // let's make sure we also double check
                            // fallbacks are correctly hidden or shown
                            checkSlotFallbackVisibility = true;
                            // ensure that the slot-name attr is correct
                            node['s-sn'] = node['s-sn'] || slotName;
                            if (relocateNodeData) {
                                relocateNodeData.$nodeToRelocate$['s-sh'] = childNode['s-hn'];
                                // we marked this node for relocation previously but didn't find
                                // out the slot reference node to which it needs to be relocated
                                // so write it down now!
                                relocateNodeData.$slotRefNode$ = childNode;
                            }
                            else {
                                node['s-sh'] = childNode['s-hn'];
                                // add to our list of nodes to relocate
                                relocateNodes.push({
                                    $slotRefNode$: childNode,
                                    $nodeToRelocate$: node,
                                });
                            }
                            if (node['s-sr']) {
                                relocateNodes.map((relocateNode) => {
                                    if (isNodeLocatedInSlot(relocateNode.$nodeToRelocate$, node['s-sn'])) {
                                        relocateNodeData = relocateNodes.find((r) => r.$nodeToRelocate$ === node);
                                        if (relocateNodeData && !relocateNode.$slotRefNode$) {
                                            relocateNode.$slotRefNode$ = relocateNodeData.$slotRefNode$;
                                        }
                                    }
                                });
                            }
                        }
                        else if (!relocateNodes.some((r) => r.$nodeToRelocate$ === node)) {
                            // the node is not found within the slot (`childNode`) that we're
                            // currently looking at, so we stick it into `relocateNodes` to
                            // handle later. If we never find a home for this element then
                            // we'll need to hide it
                            relocateNodes.push({
                                $nodeToRelocate$: node,
                            });
                        }
                    }
                }
            }
            // if we're dealing with any type of element (capable of itself being a
            // slot reference or containing one) then we recur
            if (childNode.nodeType === 1 /* NODE_TYPE.ElementNode */) {
                markSlotContentForRelocation(childNode);
            }
        }
    };
    /**
     * Check whether a node is located in a given named slot.
     *
     * @param nodeToRelocate the node of interest
     * @param slotName the slot name to check
     * @returns whether the node is located in the slot or not
     */
    const isNodeLocatedInSlot = (nodeToRelocate, slotName) => {
        if (nodeToRelocate.nodeType === 1 /* NODE_TYPE.ElementNode */) {
            if (nodeToRelocate.getAttribute('slot') === null && slotName === '') {
                // if the node doesn't have a slot attribute, and the slot we're checking
                // is not a named slot, then we assume the node should be within the slot
                return true;
            }
            if (nodeToRelocate.getAttribute('slot') === slotName) {
                return true;
            }
            return false;
        }
        if (nodeToRelocate['s-sn'] === slotName) {
            return true;
        }
        return slotName === '';
    };
    /**
     * 'Nullify' any VDom `ref` callbacks on a VDom node or its children by calling
     * them with `null`. This signals that the DOM element corresponding to the VDom
     * node has been removed from the DOM.
     *
     * @param vNode a virtual DOM node
     */
    const nullifyVNodeRefs = (vNode) => {
        {
            vNode.$attrs$ && vNode.$attrs$.ref && vNode.$attrs$.ref(null);
            vNode.$children$ && vNode.$children$.map(nullifyVNodeRefs);
        }
    };
    /**
     * The main entry point for Stencil's virtual DOM-based rendering engine
     *
     * Given a {@link d.HostRef} container and some virtual DOM nodes, this
     * function will handle creating a virtual DOM tree with a single root, patching
     * the current virtual DOM tree onto an old one (if any), dealing with slot
     * relocation, and reflecting attributes.
     *
     * @param hostRef data needed to root and render the virtual DOM tree, such as
     * the DOM node into which it should be rendered.
     * @param renderFnResults the virtual DOM nodes to be rendered
     * @param isInitialLoad whether or not this is the first call after page load
     */
    const renderVdom = (hostRef, renderFnResults, isInitialLoad = false) => {
        var _a, _b, _c, _d, _e;
        const hostElm = hostRef.$hostElement$;
        const cmpMeta = hostRef.$cmpMeta$;
        const oldVNode = hostRef.$vnode$ || newVNode(null, null);
        // if `renderFnResults` is a Host node then we can use it directly. If not,
        // we need to call `h` again to wrap the children of our component in a
        // 'dummy' Host node (well, an empty vnode) since `renderVdom` assumes
        // implicitly that the top-level vdom node is 1) an only child and 2)
        // contains attrs that need to be set on the host element.
        const rootVnode = isHost(renderFnResults) ? renderFnResults : h(null, null, renderFnResults);
        hostTagName = hostElm.tagName;
        if (cmpMeta.$attrsToReflect$) {
            rootVnode.$attrs$ = rootVnode.$attrs$ || {};
            cmpMeta.$attrsToReflect$.map(([propName, attribute]) => (rootVnode.$attrs$[attribute] = hostElm[propName]));
        }
        // On the first render and *only* on the first render we want to check for
        // any attributes set on the host element which are also set on the vdom
        // node. If we find them, we override the value on the VDom node attrs with
        // the value from the host element, which allows developers building apps
        // with Stencil components to override e.g. the `role` attribute on a
        // component even if it's already set on the `Host`.
        if (isInitialLoad && rootVnode.$attrs$) {
            for (const key of Object.keys(rootVnode.$attrs$)) {
                // We have a special implementation in `setAccessor` for `style` and
                // `class` which reconciles values coming from the VDom with values
                // already present on the DOM element, so we don't want to override those
                // attributes on the VDom tree with values from the host element if they
                // are present.
                //
                // Likewise, `ref` and `key` are special internal values for the Stencil
                // runtime and we don't want to override those either.
                if (hostElm.hasAttribute(key) && !['key', 'ref', 'style', 'class'].includes(key)) {
                    rootVnode.$attrs$[key] = hostElm[key];
                }
            }
        }
        rootVnode.$tag$ = null;
        rootVnode.$flags$ |= 4 /* VNODE_FLAGS.isHost */;
        hostRef.$vnode$ = rootVnode;
        rootVnode.$elm$ = oldVNode.$elm$ = (hostElm.shadowRoot || hostElm );
        {
            scopeId = hostElm['s-sc'];
        }
        {
            contentRef = hostElm['s-cr'];
            useNativeShadowDom = (cmpMeta.$flags$ & 1 /* CMP_FLAGS.shadowDomEncapsulation */) !== 0;
            // always reset
            checkSlotFallbackVisibility = false;
        }
        // synchronous patch
        patch(oldVNode, rootVnode, isInitialLoad);
        {
            // while we're moving nodes around existing nodes, temporarily disable
            // the disconnectCallback from working
            plt.$flags$ |= 1 /* PLATFORM_FLAGS.isTmpDisconnected */;
            if (checkSlotRelocate) {
                markSlotContentForRelocation(rootVnode.$elm$);
                for (const relocateData of relocateNodes) {
                    const nodeToRelocate = relocateData.$nodeToRelocate$;
                    if (!nodeToRelocate['s-ol']) {
                        // add a reference node marking this node's original location
                        // keep a reference to this node for later lookups
                        const orgLocationNode = doc.createTextNode('');
                        orgLocationNode['s-nr'] = nodeToRelocate;
                        nodeToRelocate.parentNode.insertBefore((nodeToRelocate['s-ol'] = orgLocationNode), nodeToRelocate);
                    }
                }
                for (const relocateData of relocateNodes) {
                    const nodeToRelocate = relocateData.$nodeToRelocate$;
                    const slotRefNode = relocateData.$slotRefNode$;
                    if (slotRefNode) {
                        const parentNodeRef = slotRefNode.parentNode;
                        // When determining where to insert content, the most simple case would be
                        // to relocate the node immediately following the slot reference node. We do this
                        // by getting a reference to the node immediately following the slot reference node
                        // since we will use `insertBefore` to manipulate the DOM.
                        //
                        // If there is no node immediately following the slot reference node, then we will just
                        // end up appending the node as the last child of the parent.
                        let insertBeforeNode = slotRefNode.nextSibling;
                        // If the node we're currently planning on inserting the new node before is an element,
                        // we need to do some additional checks to make sure we're inserting the node in the correct order.
                        // The use case here would be that we have multiple nodes being relocated to the same slot. So, we want
                        // to make sure they get inserted into their new how in the same order they were declared in their original location.
                        //
                        // TODO(STENCIL-914): Remove `experimentalSlotFixes` check
                        {
                            let orgLocationNode = (_a = nodeToRelocate['s-ol']) === null || _a === void 0 ? void 0 : _a.previousSibling;
                            while (orgLocationNode) {
                                let refNode = (_b = orgLocationNode['s-nr']) !== null && _b !== void 0 ? _b : null;
                                if (refNode && refNode['s-sn'] === nodeToRelocate['s-sn'] && parentNodeRef === refNode.parentNode) {
                                    refNode = refNode.nextSibling;
                                    if (!refNode || !refNode['s-nr']) {
                                        insertBeforeNode = refNode;
                                        break;
                                    }
                                }
                                orgLocationNode = orgLocationNode.previousSibling;
                            }
                        }
                        if ((!insertBeforeNode && parentNodeRef !== nodeToRelocate.parentNode) ||
                            nodeToRelocate.nextSibling !== insertBeforeNode) {
                            // we've checked that it's worth while to relocate
                            // since that the node to relocate
                            // has a different next sibling or parent relocated
                            if (nodeToRelocate !== insertBeforeNode) {
                                if (!nodeToRelocate['s-hn'] && nodeToRelocate['s-ol']) {
                                    // probably a component in the index.html that doesn't have its hostname set
                                    nodeToRelocate['s-hn'] = nodeToRelocate['s-ol'].parentNode.nodeName;
                                }
                                // Add it back to the dom but in its new home
                                // If we get to this point and `insertBeforeNode` is `null`, that means
                                // we're just going to append the node as the last child of the parent. Passing
                                // `null` as the second arg here will trigger that behavior.
                                parentNodeRef.insertBefore(nodeToRelocate, insertBeforeNode);
                                // Reset the `hidden` value back to what it was defined as originally
                                // This solves a problem where a `slot` is dynamically rendered and `hidden` may have
                                // been set on content originally, but now it has a slot to go to so it should have
                                // the value it was defined as having in the DOM, not what we overrode it to.
                                if (nodeToRelocate.nodeType === 1 /* NODE_TYPE.ElementNode */) {
                                    nodeToRelocate.hidden = (_c = nodeToRelocate['s-ih']) !== null && _c !== void 0 ? _c : false;
                                }
                            }
                        }
                    }
                    else {
                        // this node doesn't have a slot home to go to, so let's hide it
                        if (nodeToRelocate.nodeType === 1 /* NODE_TYPE.ElementNode */) {
                            // Store the initial value of `hidden` so we can reset it later when
                            // moving nodes around.
                            if (isInitialLoad) {
                                nodeToRelocate['s-ih'] = (_d = nodeToRelocate.hidden) !== null && _d !== void 0 ? _d : false;
                            }
                            nodeToRelocate.hidden = true;
                        }
                    }
                }
            }
            if (checkSlotFallbackVisibility) {
                updateFallbackSlotVisibility(rootVnode.$elm$);
            }
            // done moving nodes around
            // allow the disconnect callback to work again
            plt.$flags$ &= ~1 /* PLATFORM_FLAGS.isTmpDisconnected */;
            // always reset
            relocateNodes.length = 0;
        }
        // Hide any elements that were projected through, but don't have a slot to go to.
        // Only an issue if there were no "slots" rendered. Otherwise, nodes are hidden correctly.
        // This _only_ happens for `scoped` components!
        if (BUILD.experimentalScopedSlotChanges && cmpMeta.$flags$ & 2 /* CMP_FLAGS.scopedCssEncapsulation */) {
            for (const childNode of rootVnode.$elm$.childNodes) {
                if (childNode['s-hn'] !== hostTagName && !childNode['s-sh']) {
                    // Store the initial value of `hidden` so we can reset it later when
                    // moving nodes around.
                    if (isInitialLoad && childNode['s-ih'] == null) {
                        childNode['s-ih'] = (_e = childNode.hidden) !== null && _e !== void 0 ? _e : false;
                    }
                    childNode.hidden = true;
                }
            }
        }
        // Clear the content ref so we don't create a memory leak
        contentRef = undefined;
    };
    const attachToAncestor = (hostRef, ancestorComponent) => {
    };
    const scheduleUpdate = (hostRef, isInitialLoad) => {
        {
            hostRef.$flags$ |= 16 /* HOST_FLAGS.isQueuedForUpdate */;
        }
        attachToAncestor(hostRef, hostRef.$ancestorComponent$);
        // there is no ancestor component or the ancestor component
        // has already fired off its lifecycle update then
        // fire off the initial update
        const dispatch = () => dispatchHooks(hostRef, isInitialLoad);
        return writeTask(dispatch) ;
    };
    /**
     * Dispatch initial-render and update lifecycle hooks, enqueuing calls to
     * component lifecycle methods like `componentWillLoad` as well as
     * {@link updateComponent}, which will kick off the virtual DOM re-render.
     *
     * @param hostRef a reference to a host DOM node
     * @param isInitialLoad whether we're on the initial load or not
     * @returns an empty Promise which is used to enqueue a series of operations for
     * the component
     */
    const dispatchHooks = (hostRef, isInitialLoad) => {
        const elm = hostRef.$hostElement$;
        const endSchedule = createTime('scheduleUpdate', hostRef.$cmpMeta$.$tagName$);
        const instance = elm;
        // We're going to use this variable together with `enqueue` to implement a
        // little promise-based queue. We start out with it `undefined`. When we add
        // the first function to the queue we'll set this variable to be that
        // function's return value. When we attempt to add subsequent values to the
        // queue we'll check that value and, if it was a `Promise`, we'll then chain
        // the new function off of that `Promise` using `.then()`. This will give our
        // queue two nice properties:
        //
        // 1. If all functions added to the queue are synchronous they'll be called
        //    synchronously right away.
        // 2. If all functions added to the queue are asynchronous they'll all be
        //    called in order after `dispatchHooks` exits.
        let maybePromise;
        if (isInitialLoad) {
            {
                // If `componentWillLoad` returns a `Promise` then we want to wait on
                // whatever's going on in that `Promise` before we launch into
                // rendering the component, doing other lifecycle stuff, etc. So
                // in that case we assign the returned promise to the variable we
                // declared above to hold a possible 'queueing' Promise
                maybePromise = safeCall(instance, 'componentWillLoad');
            }
        }
        else {
            {
                // Like `componentWillLoad` above, we allow Stencil component
                // authors to return a `Promise` from this lifecycle callback, and
                // we specify that our runtime will wait for that `Promise` to
                // resolve before the component re-renders. So if the method
                // returns a `Promise` we need to keep it around!
                maybePromise = safeCall(instance, 'componentWillUpdate');
            }
        }
        {
            maybePromise = enqueue(maybePromise, () => safeCall(instance, 'componentWillRender'));
        }
        endSchedule();
        return enqueue(maybePromise, () => updateComponent(hostRef, instance, isInitialLoad));
    };
    /**
     * This function uses a Promise to implement a simple first-in, first-out queue
     * of functions to be called.
     *
     * The queue is ordered on the basis of the first argument. If it's
     * `undefined`, then nothing is on the queue yet, so the provided function can
     * be called synchronously (although note that this function may return a
     * `Promise`). The idea is that then the return value of that enqueueing
     * operation is kept around, so that if it was a `Promise` then subsequent
     * functions can be enqueued by calling this function again with that `Promise`
     * as the first argument.
     *
     * @param maybePromise either a `Promise` which should resolve before the next function is called or an 'empty' sentinel
     * @param fn a function to enqueue
     * @returns either a `Promise` or the return value of the provided function
     */
    const enqueue = (maybePromise, fn) => isPromisey(maybePromise) ? maybePromise.then(fn) : fn();
    /**
     * Check that a value is a `Promise`. To check, we first see if the value is an
     * instance of the `Promise` global. In a few circumstances, in particular if
     * the global has been overwritten, this is could be misleading, so we also do
     * a little 'duck typing' check to see if the `.then` property of the value is
     * defined and a function.
     *
     * @param maybePromise it might be a promise!
     * @returns whether it is or not
     */
    const isPromisey = (maybePromise) => maybePromise instanceof Promise ||
        (maybePromise && maybePromise.then && typeof maybePromise.then === 'function');
    /**
     * Update a component given reference to its host elements and so on.
     *
     * @param hostRef an object containing references to the element's host node,
     * VDom nodes, and other metadata
     * @param instance a reference to the underlying host element where it will be
     * rendered
     * @param isInitialLoad whether or not this function is being called as part of
     * the first render cycle
     */
    const updateComponent = async (hostRef, instance, isInitialLoad) => {
        const elm = hostRef.$hostElement$;
        const endUpdate = createTime('update', hostRef.$cmpMeta$.$tagName$);
        elm['s-rc'];
        if (isInitialLoad) {
            // DOM WRITE!
            attachStyles(hostRef);
        }
        const endRender = createTime('render', hostRef.$cmpMeta$.$tagName$);
        {
            callRender(hostRef, instance, elm, isInitialLoad);
        }
        endRender();
        endUpdate();
        {
            postUpdateComponent(hostRef);
        }
    };
    /**
     * Handle making the call to the VDom renderer with the proper context given
     * various build variables
     *
     * @param hostRef an object containing references to the element's host node,
     * VDom nodes, and other metadata
     * @param instance a reference to the underlying host element where it will be
     * rendered
     * @param elm the Host element for the component
     * @param isInitialLoad whether or not this function is being called as part of
     * @returns an empty promise
     */
    const callRender = (hostRef, instance, elm, isInitialLoad) => {
        // in order for bundlers to correctly tree-shake the BUILD object
        // we need to ensure BUILD is not deoptimized within a try/catch
        // https://rollupjs.org/guide/en/#treeshake tryCatchDeoptimization
        const allRenderFn = false;
        const lazyLoad = false;
        const taskQueue = true ;
        const updatable = true ;
        try {
            renderingRef = instance;
            /**
             * minification optimization: `allRenderFn` is `true` if all components have a `render`
             * method, so we can call the method immediately. If not, check before calling it.
             */
            instance = allRenderFn ? instance.render() : instance.render && instance.render();
            if (updatable && taskQueue) {
                hostRef.$flags$ &= ~16 /* HOST_FLAGS.isQueuedForUpdate */;
            }
            if (updatable || lazyLoad) {
                hostRef.$flags$ |= 2 /* HOST_FLAGS.hasRendered */;
            }
            if (BUILD.hasRenderFn || BUILD.reflect) {
                if (BUILD.vdomRender || BUILD.reflect) {
                    // looks like we've got child nodes to render into this host element
                    // or we need to update the css class/attrs on the host element
                    // DOM WRITE!
                    if (BUILD.hydrateServerSide) ;
                    else {
                        renderVdom(hostRef, instance, isInitialLoad);
                    }
                }
            }
        }
        catch (e) {
            consoleError(e, hostRef.$hostElement$);
        }
        renderingRef = null;
        return null;
    };
    const postUpdateComponent = (hostRef) => {
        const tagName = hostRef.$cmpMeta$.$tagName$;
        const elm = hostRef.$hostElement$;
        const endPostUpdate = createTime('postUpdate', tagName);
        const instance = elm;
        hostRef.$ancestorComponent$;
        {
            safeCall(instance, 'componentDidRender');
        }
        if (!(hostRef.$flags$ & 64 /* HOST_FLAGS.hasLoadedComponent */)) {
            hostRef.$flags$ |= 64 /* HOST_FLAGS.hasLoadedComponent */;
            {
                safeCall(instance, 'componentDidLoad');
            }
            endPostUpdate();
        }
        else {
            {
                safeCall(instance, 'componentDidUpdate');
            }
            endPostUpdate();
        }
        // ( •_•)
        // ( •_•)>⌐■-■
        // (⌐■_■)
    };
    /**
     * Allows to safely call a method, e.g. `componentDidLoad`, on an instance,
     * e.g. custom element node. If a build figures out that e.g. no component
     * has a `componentDidLoad` method, the instance method gets removed from the
     * output bundle and this function returns `undefined`.
     * @param instance any object that may or may not contain methods
     * @param method method name
     * @param arg single arbitrary argument
     * @returns result of method call if it exists, otherwise `undefined`
     */
    const safeCall = (instance, method, arg) => {
        if (instance && instance[method]) {
            try {
                return instance[method](arg);
            }
            catch (e) {
                consoleError(e);
            }
        }
        return undefined;
    };
    const getValue = (ref, propName) => getHostRef(ref).$instanceValues$.get(propName);
    const setValue = (ref, propName, newVal, cmpMeta) => {
        // check our new property value against our internal value
        const hostRef = getHostRef(ref);
        const elm = ref;
        const oldVal = hostRef.$instanceValues$.get(propName);
        const flags = hostRef.$flags$;
        const instance = elm;
        newVal = parsePropertyValue(newVal, cmpMeta.$members$[propName][0]);
        // explicitly check for NaN on both sides, as `NaN === NaN` is always false
        const areBothNaN = Number.isNaN(oldVal) && Number.isNaN(newVal);
        const didValueChange = newVal !== oldVal && !areBothNaN;
        if (didValueChange) {
            // gadzooks! the property's value has changed!!
            // set our new value!
            hostRef.$instanceValues$.set(propName, newVal);
            {
                // get an array of method names of watch functions to call
                if (cmpMeta.$watchers$ && flags & 128 /* HOST_FLAGS.isWatchReady */) {
                    const watchMethods = cmpMeta.$watchers$[propName];
                    if (watchMethods) {
                        // this instance is watching for when this property changed
                        watchMethods.map((watchMethodName) => {
                            try {
                                // fire off each of the watch methods that are watching this property
                                instance[watchMethodName](newVal, oldVal, propName);
                            }
                            catch (e) {
                                consoleError(e, elm);
                            }
                        });
                    }
                }
                if ((flags & (2 /* HOST_FLAGS.hasRendered */ | 16 /* HOST_FLAGS.isQueuedForUpdate */)) === 2 /* HOST_FLAGS.hasRendered */) {
                    if (instance.componentShouldUpdate) {
                        if (instance.componentShouldUpdate(newVal, oldVal, propName) === false) {
                            return;
                        }
                    }
                    // looks like this value actually changed, so we've got work to do!
                    // but only if we've already rendered, otherwise just chill out
                    // queue that we need to do an update, but don't worry about queuing
                    // up millions cuz this function ensures it only runs once
                    scheduleUpdate(hostRef, false);
                }
            }
        }
    };
    /**
     * Attach a series of runtime constructs to a compiled Stencil component
     * constructor, including getters and setters for the `@Prop` and `@State`
     * decorators, callbacks for when attributes change, and so on.
     *
     * @param Cstr the constructor for a component that we need to process
     * @param cmpMeta metadata collected previously about the component
     * @param flags a number used to store a series of bit flags
     * @returns a reference to the same constructor passed in (but now mutated)
     */
    const proxyComponent = (Cstr, cmpMeta, flags) => {
        var _a;
        const prototype = Cstr.prototype;
        if (cmpMeta.$members$) {
            if (Cstr.watchers) {
                cmpMeta.$watchers$ = Cstr.watchers;
            }
            // It's better to have a const than two Object.entries()
            const members = Object.entries(cmpMeta.$members$);
            members.map(([memberName, [memberFlags]]) => {
                if ((memberFlags & 31 /* MEMBER_FLAGS.Prop */ ||
                        (memberFlags & 32 /* MEMBER_FLAGS.State */))) {
                    // proxyComponent - prop
                    Object.defineProperty(prototype, memberName, {
                        get() {
                            // proxyComponent, get value
                            return getValue(this, memberName);
                        },
                        set(newValue) {
                            // proxyComponent, set value
                            setValue(this, memberName, newValue, cmpMeta);
                        },
                        configurable: true,
                        enumerable: true,
                    });
                }
            });
            {
                const attrNameToPropName = new Map();
                prototype.attributeChangedCallback = function (attrName, oldValue, newValue) {
                    plt.jmp(() => {
                        var _a;
                        const propName = attrNameToPropName.get(attrName);
                        //  In a web component lifecycle the attributeChangedCallback runs prior to connectedCallback
                        //  in the case where an attribute was set inline.
                        //  ```html
                        //    <my-component some-attribute="some-value"></my-component>
                        //  ```
                        //
                        //  There is an edge case where a developer sets the attribute inline on a custom element and then
                        //  programmatically changes it before it has been upgraded as shown below:
                        //
                        //  ```html
                        //    <!-- this component has _not_ been upgraded yet -->
                        //    <my-component id="test" some-attribute="some-value"></my-component>
                        //    <script>
                        //      // grab non-upgraded component
                        //      el = document.querySelector("#test");
                        //      el.someAttribute = "another-value";
                        //      // upgrade component
                        //      customElements.define('my-component', MyComponent);
                        //    </script>
                        //  ```
                        //  In this case if we do not un-shadow here and use the value of the shadowing property, attributeChangedCallback
                        //  will be called with `newValue = "some-value"` and will set the shadowed property (this.someAttribute = "another-value")
                        //  to the value that was set inline i.e. "some-value" from above example. When
                        //  the connectedCallback attempts to un-shadow it will use "some-value" as the initial value rather than "another-value"
                        //
                        //  The case where the attribute was NOT set inline but was not set programmatically shall be handled/un-shadowed
                        //  by connectedCallback as this attributeChangedCallback will not fire.
                        //
                        //  https://developers.google.com/web/fundamentals/web-components/best-practices#lazy-properties
                        //
                        //  TODO(STENCIL-16) we should think about whether or not we actually want to be reflecting the attributes to
                        //  properties here given that this goes against best practices outlined here
                        //  https://developers.google.com/web/fundamentals/web-components/best-practices#avoid-reentrancy
                        if (this.hasOwnProperty(propName)) {
                            newValue = this[propName];
                            delete this[propName];
                        }
                        else if (prototype.hasOwnProperty(propName) &&
                            typeof this[propName] === 'number' &&
                            this[propName] == newValue) {
                            // if the propName exists on the prototype of `Cstr`, this update may be a result of Stencil using native
                            // APIs to reflect props as attributes. Calls to `setAttribute(someElement, propName)` will result in
                            // `propName` to be converted to a `DOMString`, which may not be what we want for other primitive props.
                            return;
                        }
                        else if (propName == null) {
                            // At this point we should know this is not a "member", so we can treat it like watching an attribute
                            // on a vanilla web component
                            const hostRef = getHostRef(this);
                            const flags = hostRef === null || hostRef === void 0 ? void 0 : hostRef.$flags$;
                            // We only want to trigger the callback(s) if:
                            // 1. The instance is ready
                            // 2. The watchers are ready
                            // 3. The value has changed
                            if (flags &&
                                !(flags & 8 /* HOST_FLAGS.isConstructingInstance */) &&
                                flags & 128 /* HOST_FLAGS.isWatchReady */ &&
                                newValue !== oldValue) {
                                const elm = this;
                                const instance = elm;
                                const entry = (_a = cmpMeta.$watchers$) === null || _a === void 0 ? void 0 : _a[attrName];
                                entry === null || entry === void 0 ? void 0 : entry.forEach((callbackName) => {
                                    if (instance[callbackName] != null) {
                                        instance[callbackName].call(instance, newValue, oldValue, attrName);
                                    }
                                });
                            }
                            return;
                        }
                        this[propName] = newValue === null && typeof this[propName] === 'boolean' ? false : newValue;
                    });
                };
                // Create an array of attributes to observe
                // This list in comprised of all strings used within a `@Watch()` decorator
                // on a component as well as any Stencil-specific "members" (`@Prop()`s and `@State()`s).
                // As such, there is no way to guarantee type-safety here that a user hasn't entered
                // an invalid attribute.
                Cstr.observedAttributes = Array.from(new Set([
                    ...Object.keys((_a = cmpMeta.$watchers$) !== null && _a !== void 0 ? _a : {}),
                    ...members
                        .filter(([_, m]) => m[0] & 15 /* MEMBER_FLAGS.HasAttribute */)
                        .map(([propName, m]) => {
                        var _a;
                        const attrName = m[1] || propName;
                        attrNameToPropName.set(attrName, propName);
                        if (m[0] & 512 /* MEMBER_FLAGS.ReflectAttr */) {
                            (_a = cmpMeta.$attrsToReflect$) === null || _a === void 0 ? void 0 : _a.push([propName, attrName]);
                        }
                        return attrName;
                    }),
                ]));
            }
        }
        return Cstr;
    };
    /**
     * Initialize a Stencil component given a reference to its host element, its
     * runtime bookkeeping data structure, runtime metadata about the component,
     * and (optionally) an HMR version ID.
     *
     * @param elm a host element
     * @param hostRef the element's runtime bookkeeping object
     * @param cmpMeta runtime metadata for the Stencil component
     * @param hmrVersionId an (optional) HMR version ID
     */
    const initializeComponent = async (elm, hostRef, cmpMeta, hmrVersionId) => {
        let Cstr;
        // initializeComponent
        if ((hostRef.$flags$ & 32 /* HOST_FLAGS.hasInitializedComponent */) === 0) {
            // Let the runtime know that the component has been initialized
            hostRef.$flags$ |= 32 /* HOST_FLAGS.hasInitializedComponent */;
            {
                // sync constructor component
                Cstr = elm.constructor;
                // wait for the CustomElementRegistry to mark the component as ready before setting `isWatchReady`. Otherwise,
                // watchers may fire prematurely if `customElements.get()`/`customElements.whenDefined()` resolves _before_
                // Stencil has completed instantiating the component.
                customElements.whenDefined(cmpMeta.$tagName$).then(() => (hostRef.$flags$ |= 128 /* HOST_FLAGS.isWatchReady */));
            }
            if (Cstr.style) {
                // this component has styles but we haven't registered them yet
                let style = Cstr.style;
                if (typeof style !== 'string') {
                    style = style[(hostRef.$modeName$ = computeMode(elm))];
                }
                const scopeId = getScopeId(cmpMeta, hostRef.$modeName$);
                if (!styles.has(scopeId)) {
                    const endRegisterStyles = createTime('registerStyles', cmpMeta.$tagName$);
                    registerStyle(scopeId, style, !!(cmpMeta.$flags$ & 1 /* CMP_FLAGS.shadowDomEncapsulation */));
                    endRegisterStyles();
                }
            }
        }
        // we've successfully created a lazy instance
        hostRef.$ancestorComponent$;
        const schedule = () => scheduleUpdate(hostRef, true);
        {
            schedule();
        }
    };
    const fireConnectedCallback = (instance) => {
    };
    const connectedCallback = (elm) => {
        if ((plt.$flags$ & 1 /* PLATFORM_FLAGS.isTmpDisconnected */) === 0) {
            const hostRef = getHostRef(elm);
            const cmpMeta = hostRef.$cmpMeta$;
            const endConnected = createTime('connectedCallback', cmpMeta.$tagName$);
            if (!(hostRef.$flags$ & 1 /* HOST_FLAGS.hasConnected */)) {
                // first time this component has connected
                hostRef.$flags$ |= 1 /* HOST_FLAGS.hasConnected */;
                {
                    // initUpdate
                    // if the slot polyfill is required we'll need to put some nodes
                    // in here to act as original content anchors as we move nodes around
                    // host element has been connected to the DOM
                    if ((// TODO(STENCIL-854): Remove code related to legacy shadowDomShim field
                            cmpMeta.$flags$ & (4 /* CMP_FLAGS.hasSlotRelocation */ | 8 /* CMP_FLAGS.needsShadowDomShim */))) {
                        setContentReference(elm);
                    }
                }
                // Lazy properties
                // https://developers.google.com/web/fundamentals/web-components/best-practices#lazy-properties
                if (cmpMeta.$members$) {
                    Object.entries(cmpMeta.$members$).map(([memberName, [memberFlags]]) => {
                        if (memberFlags & 31 /* MEMBER_FLAGS.Prop */ && elm.hasOwnProperty(memberName)) {
                            const value = elm[memberName];
                            delete elm[memberName];
                            elm[memberName] = value;
                        }
                    });
                }
                {
                    initializeComponent(elm, hostRef, cmpMeta);
                }
            }
            else {
                // not the first time this has connected
                // reattach any event listeners to the host
                // since they would have been removed when disconnected
                addHostEventListeners(elm, hostRef, cmpMeta.$listeners$);
                // fire off connectedCallback() on component instance
                if (hostRef === null || hostRef === void 0 ? void 0 : hostRef.$lazyInstance$) {
                    fireConnectedCallback(hostRef.$lazyInstance$);
                }
                else if (hostRef === null || hostRef === void 0 ? void 0 : hostRef.$onReadyPromise$) {
                    hostRef.$onReadyPromise$.then(() => fireConnectedCallback(hostRef.$lazyInstance$));
                }
            }
            endConnected();
        }
    };
    const setContentReference = (elm) => {
        // only required when we're NOT using native shadow dom (slot)
        // or this browser doesn't support native shadow dom
        // and this host element was NOT created with SSR
        // let's pick out the inner content for slot projection
        // create a node to represent where the original
        // content was first placed, which is useful later on
        const contentRefElm = (elm['s-cr'] = doc.createComment(''));
        contentRefElm['s-cn'] = true;
        elm.insertBefore(contentRefElm, elm.firstChild);
    };
    const disconnectedCallback = async (elm) => {
        if ((plt.$flags$ & 1 /* PLATFORM_FLAGS.isTmpDisconnected */) === 0) {
            const hostRef = getHostRef(elm);
            {
                if (hostRef.$rmListeners$) {
                    hostRef.$rmListeners$.map((rmListener) => rmListener());
                    hostRef.$rmListeners$ = undefined;
                }
            }
        }
    };
    const proxyCustomElement = (Cstr, compactMeta) => {
        const cmpMeta = {
            $flags$: compactMeta[0],
            $tagName$: compactMeta[1],
        };
        {
            cmpMeta.$members$ = compactMeta[2];
        }
        {
            cmpMeta.$listeners$ = compactMeta[3];
        }
        {
            cmpMeta.$watchers$ = Cstr.$watchers$;
        }
        {
            cmpMeta.$attrsToReflect$ = [];
        }
        if (!supportsShadow && cmpMeta.$flags$ & 1 /* CMP_FLAGS.shadowDomEncapsulation */) {
            // TODO(STENCIL-854): Remove code related to legacy shadowDomShim field
            cmpMeta.$flags$ |= 8 /* CMP_FLAGS.needsShadowDomShim */;
        }
        const originalConnectedCallback = Cstr.prototype.connectedCallback;
        const originalDisconnectedCallback = Cstr.prototype.disconnectedCallback;
        Object.assign(Cstr.prototype, {
            __registerHost() {
                registerHost(this, cmpMeta);
            },
            connectedCallback() {
                connectedCallback(this);
                if (originalConnectedCallback) {
                    originalConnectedCallback.call(this);
                }
            },
            disconnectedCallback() {
                disconnectedCallback(this);
                if (originalDisconnectedCallback) {
                    originalDisconnectedCallback.call(this);
                }
            },
            __attachShadow() {
                if (supportsShadow) {
                    {
                        this.attachShadow({
                            mode: 'open',
                            delegatesFocus: !!(cmpMeta.$flags$ & 16 /* CMP_FLAGS.shadowDelegatesFocus */),
                        });
                    }
                }
                else {
                    this.shadowRoot = this;
                }
            },
        });
        Cstr.is = cmpMeta.$tagName$;
        return proxyComponent(Cstr, cmpMeta);
    };
    const addHostEventListeners = (elm, hostRef, listeners, attachParentListeners) => {
        if (listeners) {
            listeners.map(([flags, name, method]) => {
                const target = getHostListenerTarget(elm, flags) ;
                const handler = hostListenerProxy(hostRef, method);
                const opts = hostListenerOpts(flags);
                plt.ael(target, name, handler, opts);
                (hostRef.$rmListeners$ = hostRef.$rmListeners$ || []).push(() => plt.rel(target, name, handler, opts));
            });
        }
    };
    const hostListenerProxy = (hostRef, methodName) => (ev) => {
        try {
            if (BUILD.lazyLoad) ;
            else {
                hostRef.$hostElement$[methodName](ev);
            }
        }
        catch (e) {
            consoleError(e);
        }
    };
    const getHostListenerTarget = (elm, flags) => {
        if (flags & 4 /* LISTENER_FLAGS.TargetDocument */)
            return doc;
        if (flags & 8 /* LISTENER_FLAGS.TargetWindow */)
            return win;
        if (flags & 16 /* LISTENER_FLAGS.TargetBody */)
            return doc.body;
        return elm;
    };
    // prettier-ignore
    const hostListenerOpts = (flags) => supportsListenerOptions
        ? ({
            passive: (flags & 1 /* LISTENER_FLAGS.Passive */) !== 0,
            capture: (flags & 2 /* LISTENER_FLAGS.Capture */) !== 0,
        })
        : (flags & 2 /* LISTENER_FLAGS.Capture */) !== 0;
    /**
     * A WeakMap mapping runtime component references to their corresponding host reference
     * instances.
     */
    const hostRefs = /*@__PURE__*/ new WeakMap();
    /**
     * Given a {@link d.RuntimeRef} retrieve the corresponding {@link d.HostRef}
     *
     * @param ref the runtime ref of interest
     * @returns the Host reference (if found) or undefined
     */
    const getHostRef = (ref) => hostRefs.get(ref);
    /**
     * Register a host element for a Stencil component, setting up various metadata
     * and callbacks based on {@link BUILD} flags as well as the component's runtime
     * metadata.
     *
     * @param hostElement the host element to register
     * @param cmpMeta runtime metadata for that component
     * @returns a reference to the host ref WeakMap
     */
    const registerHost = (hostElement, cmpMeta) => {
        const hostRef = {
            $flags$: 0,
            $hostElement$: hostElement,
            $cmpMeta$: cmpMeta,
            $instanceValues$: new Map(),
        };
        addHostEventListeners(hostElement, hostRef, cmpMeta.$listeners$);
        return hostRefs.set(hostElement, hostRef);
    };
    const isMemberInElement = (elm, memberName) => memberName in elm;
    const consoleError = (e, el) => (0, console.error)(e, el);
    const styles = /*@__PURE__*/ new Map();
    const modeResolutionChain = [];
    const win = typeof window !== 'undefined' ? window : {};
    const doc = win.document || { head: {} };
    const H = (win.HTMLElement || class {
    });
    const plt = {
        $flags$: 0,
        $resourcesUrl$: '',
        jmp: (h) => h(),
        raf: (h) => requestAnimationFrame(h),
        ael: (el, eventName, listener, opts) => el.addEventListener(eventName, listener, opts),
        rel: (el, eventName, listener, opts) => el.removeEventListener(eventName, listener, opts),
        ce: (eventName, opts) => new CustomEvent(eventName, opts),
    };
    const supportsShadow = 
    // TODO(STENCIL-854): Remove code related to legacy shadowDomShim field
    true;
    const supportsListenerOptions = /*@__PURE__*/ (() => {
        let supportsListenerOptions = false;
        try {
            doc.addEventListener('e', null, Object.defineProperty({}, 'passive', {
                get() {
                    supportsListenerOptions = true;
                },
            }));
        }
        catch (e) { }
        return supportsListenerOptions;
    })();
    const promiseResolve = (v) => Promise.resolve(v);
    const supportsConstructableStylesheets = /*@__PURE__*/ (() => {
            try {
                new CSSStyleSheet();
                return typeof new CSSStyleSheet().replaceSync === 'function';
            }
            catch (e) { }
            return false;
        })()
        ;
    const queueDomReads = [];
    const queueDomWrites = [];
    const queueTask = (queue, write) => (cb) => {
        queue.push(cb);
        if (!queuePending) {
            queuePending = true;
            if (write && plt.$flags$ & 4 /* PLATFORM_FLAGS.queueSync */) {
                nextTick(flush);
            }
            else {
                plt.raf(flush);
            }
        }
    };
    const consume = (queue) => {
        for (let i = 0; i < queue.length; i++) {
            try {
                queue[i](performance.now());
            }
            catch (e) {
                consoleError(e);
            }
        }
        queue.length = 0;
    };
    const flush = () => {
        // always force a bunch of medium callbacks to run, but still have
        // a throttle on how many can run in a certain time
        // DOM READS!!!
        consume(queueDomReads);
        // DOM WRITES!!!
        {
            consume(queueDomWrites);
            if ((queuePending = queueDomReads.length > 0)) {
                // still more to do yet, but we've run out of time
                // let's let this thing cool off and try again in the next tick
                plt.raf(flush);
            }
        }
    };
    const nextTick = (cb) => promiseResolve().then(cb);
    const writeTask = /*@__PURE__*/ queueTask(queueDomWrites, true);

    var CURRENT_MODULE;
    (function (CURRENT_MODULE) {
        CURRENT_MODULE["WELCOME"] = "welcome";
        CURRENT_MODULE["INFO"] = "info";
        CURRENT_MODULE["SIGNIN"] = "signin";
        CURRENT_MODULE["SIGNUP"] = "signup";
    })(CURRENT_MODULE || (CURRENT_MODULE = {}));
    var METHOD_MODULE;
    (function (METHOD_MODULE) {
        METHOD_MODULE["SIGNIN"] = "signin";
        METHOD_MODULE["SIGNUP"] = "signup";
        METHOD_MODULE["LOGOUT"] = "logout";
        METHOD_MODULE["CONFIRM"] = "confirm";
    })(METHOD_MODULE || (METHOD_MODULE = {}));

    const nlSelectCss = "/*! tailwindcss v3.4.1 | MIT License | https://tailwindcss.com*/*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;border:0 solid #e5e7eb;box-sizing:border-box}:after,:before{--tw-content:\"\"}:host,html{-webkit-text-size-adjust:100%;font-feature-settings:normal;-webkit-tap-highlight-color:transparent;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-variation-settings:normal;line-height:1.5;-moz-tab-size:4;tab-size:4}body{line-height:inherit;margin:0}hr{border-top-width:1px;color:inherit;height:0}abbr:where([title]){text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-feature-settings:normal;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em;font-variation-settings:normal}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{border-collapse:collapse;border-color:inherit;text-indent:0}button,input,optgroup,select,textarea{font-feature-settings:inherit;color:inherit;font-family:inherit;font-size:100%;font-variation-settings:inherit;font-weight:inherit;line-height:inherit;margin:0;padding:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,fieldset,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::placeholder,textarea::placeholder{color:#9ca3af;color:#6b7280;opacity:1}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{height:auto;max-width:100%}[hidden]{display:none}[multiple],[type=date],[type=datetime-local],[type=email],[type=month],[type=number],[type=password],[type=search],[type=tel],[type=text],[type=time],[type=url],[type=week],input:where(:not([type])),select,textarea{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;border-color:#6b7280;border-radius:0;border-width:1px;font-size:1rem;line-height:1.5rem;padding:.5rem .75rem}[multiple]:focus,[type=date]:focus,[type=datetime-local]:focus,[type=email]:focus,[type=month]:focus,[type=number]:focus,[type=password]:focus,[type=search]:focus,[type=tel]:focus,[type=text]:focus,[type=time]:focus,[type=url]:focus,[type=week]:focus,input:where(:not([type])):focus,select:focus,textarea:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);border-color:#2563eb;box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-date-and-time-value{min-height:1.5em;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-meridiem-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-year-field{padding-bottom:0;padding-top:0}select{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\");background-position:right .5rem center;background-repeat:no-repeat;background-size:1.5em 1.5em;padding-right:2.5rem;print-color-adjust:exact}[multiple],[size]:where(select:not([size=\"1\"])){background-image:none;background-position:0 0;background-repeat:unset;background-size:initial;padding-right:.75rem;print-color-adjust:unset}[type=checkbox],[type=radio]{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;background-origin:border-box;border-color:#6b7280;border-width:1px;color:#2563eb;display:inline-block;flex-shrink:0;height:1rem;padding:0;print-color-adjust:exact;user-select:none;vertical-align:middle;width:1rem}[type=checkbox]{border-radius:0}[type=radio]{border-radius:100%}[type=checkbox]:focus,[type=radio]:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:2px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}[type=checkbox]:checked,[type=radio]:checked{background-color:currentColor;background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}[type=checkbox]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=checkbox]:checked{appearance:auto}}[type=radio]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='8' cy='8' r='3'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=radio]:checked{appearance:auto}}[type=checkbox]:checked:focus,[type=checkbox]:checked:hover,[type=radio]:checked:focus,[type=radio]:checked:hover{background-color:currentColor;border-color:transparent}[type=checkbox]:indeterminate{background-color:currentColor;background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3E%3C/svg%3E\");background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}@media (forced-colors:active){[type=checkbox]:indeterminate{appearance:auto}}[type=checkbox]:indeterminate:focus,[type=checkbox]:indeterminate:hover{background-color:currentColor;border-color:transparent}[type=file]{background:unset;border-color:inherit;border-radius:0;border-width:0;font-size:unset;line-height:inherit;padding:0}[type=file]:focus{outline:1px solid ButtonText;outline:1px auto -webkit-focus-ring-color}::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;}.block{display:block}.theme-default .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-default .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-description,.theme-default .nl-logo,.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-description,.theme-default .dark .nl-logo,.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity))}.theme-default .nl-description a{--tw-text-opacity:1;color:rgb(30 64 175/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .dark .nl-description a{--tw-text-opacity:1;color:rgb(191 219 254/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .nl-action-button{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-action-button{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(249 250 251/var(--tw-bg-opacity))}.theme-default .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-divider{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .nl-divider:before{border-top-width:1px}.theme-default .nl-divider:after,.theme-default .nl-divider:before{--tw-border-opacity:1;border-color:rgb(229 231 235/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .dark .nl-divider{--tw-text-opacity:1;color:rgb(107 114 128/var(--tw-text-opacity))}.theme-default .dark .nl-divider:after,.theme-default .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(75 85 99/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .nl-footer{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-footer{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-default .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-default .nl-input{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-select-option{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(229 231 235/var(--tw-bg-opacity))}.theme-default .dark .nl-select-option{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-default .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-default .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-ocean .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(191 219 254/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-ocean .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(8 47 73/var(--tw-bg-opacity))}.theme-ocean .nl-description,.theme-ocean .nl-logo,.theme-ocean .nl-title{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-description,.theme-ocean .dark .nl-logo,.theme-ocean .dark .nl-title{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-action-button{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-action-button{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(224 242 254/var(--tw-bg-opacity));border-color:rgb(186 230 253/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 249 255/var(--tw-bg-opacity))}.theme-ocean .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));border-color:rgb(8 47 73/var(--tw-border-opacity));color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-divider{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-divider:after,.theme-ocean .nl-divider:before{--tw-border-opacity:1;border-color:rgb(8 47 73/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .dark .nl-divider{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-divider:after,.theme-ocean .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(186 230 253/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .nl-footer{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-footer{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-ocean .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-ocean .nl-input{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select-list{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(3 105 161/var(--tw-bg-opacity))}.theme-ocean .nl-select-option{--tw-text-opacity:1;color:rgb(7 89 133/var(--tw-text-opacity))}.theme-ocean .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(186 230 253/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-option{--tw-text-opacity:1;color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));color:rgb(125 211 252/var(--tw-text-opacity))}.theme-ocean .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-ocean .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-lemonade .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(187 247 208/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-lemonade .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(5 46 22/var(--tw-bg-opacity))}.theme-lemonade .nl-description,.theme-lemonade .nl-logo,.theme-lemonade .nl-title{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-description,.theme-lemonade .dark .nl-logo,.theme-lemonade .dark .nl-title{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-action-button{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-action-button{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(220 252 231/var(--tw-bg-opacity));border-color:rgb(187 247 208/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 253 244/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));border-color:rgb(5 46 22/var(--tw-border-opacity));color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-divider{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-divider:after,.theme-lemonade .nl-divider:before{--tw-border-opacity:1;border-color:rgb(5 46 22/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .dark .nl-divider{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-divider:after,.theme-lemonade .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(187 247 208/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .nl-footer{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-footer{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-lemonade .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-lemonade .nl-input{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select-list{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(21 128 61/var(--tw-bg-opacity))}.theme-lemonade .nl-select-option{--tw-text-opacity:1;color:rgb(22 101 52/var(--tw-text-opacity))}.theme-lemonade .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(187 247 208/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-option{--tw-text-opacity:1;color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));color:rgb(134 239 172/var(--tw-text-opacity))}.theme-lemonade .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-lemonade .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-purple .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(233 213 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-purple .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(59 7 100/var(--tw-bg-opacity))}.theme-purple .nl-description,.theme-purple .nl-logo,.theme-purple .nl-title{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-description,.theme-purple .dark .nl-logo,.theme-purple .dark .nl-title{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-action-button{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-action-button{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(243 232 255/var(--tw-bg-opacity));border-color:rgb(233 213 255/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(250 245 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));border-color:rgb(59 7 100/var(--tw-border-opacity));color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-divider{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-divider:after,.theme-purple .nl-divider:before{--tw-border-opacity:1;border-color:rgb(59 7 100/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .dark .nl-divider{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-divider:after,.theme-purple .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(233 213 255/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .nl-footer{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-footer{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-purple .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-purple .nl-input{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(126 34 206/var(--tw-bg-opacity))}.theme-purple .nl-select-option{--tw-text-opacity:1;color:rgb(107 33 168/var(--tw-text-opacity))}.theme-purple .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(233 213 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-option{--tw-text-opacity:1;color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));color:rgb(216 180 254/var(--tw-text-opacity))}.theme-purple .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-purple .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-purple .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-purple .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}:host{display:block}.sr-only{clip:rect(0,0,0,0);border-width:0;height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;white-space:nowrap;width:1px}.static{position:static}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.left-0{left:0}.start-0{inset-inline-start:0}.top-0{top:0}.z-\\[80\\]{z-index:80}.z-\\[81\\]{z-index:81}.flex{display:flex}.h-5{height:1.25rem}.h-7{height:1.75rem}.h-full{height:100%}.w-5{width:1.25rem}.w-7{width:1.75rem}.w-full{width:100%}.flex-shrink-0{flex-shrink:0}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-1{gap:.25rem}.gap-2{gap:.5rem}.overflow-y-auto{overflow-y:auto}.overflow-x-hidden{overflow-x:hidden}.rounded-full{border-radius:9999px}.rounded-xl{border-radius:.75rem}.border{border-width:1px}.border-transparent{border-color:transparent}.bg-gray-500{--tw-bg-opacity:1;background-color:rgb(107 114 128/var(--tw-bg-opacity))}.bg-opacity-75{--tw-bg-opacity:0.75}.px-4{padding-left:1rem;padding-right:1rem}.py-3{padding-bottom:.75rem;padding-top:.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.font-bold{font-weight:700}.font-light{font-weight:300}.font-semibold{font-weight:600}.shadow{--tw-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color),0 1px 2px -1px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}@media (min-width:640px){.sm\\:mx-auto{margin-left:auto;margin-right:auto}.sm\\:w-full{width:100%}.sm\\:max-w-lg{max-width:32rem}}.mt-1{margin-top:.25rem}.hidden{display:none}.h-4{height:1rem}.w-4{width:1rem}.min-w-\\[15rem\\]{min-width:15rem}.rotate-0{--tw-rotate:0deg}.rotate-0,.rotate-180{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.rotate-180{--tw-rotate:180deg}.cursor-pointer{cursor:pointer}.gap-x-3{column-gap:.75rem}.gap-x-3\\.5{column-gap:.875rem}.overflow-hidden,.truncate{overflow:hidden}.truncate{text-overflow:ellipsis;white-space:nowrap}.rounded-lg{border-radius:.5rem}.p-2{padding:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.py-2{padding-bottom:.5rem;padding-top:.5rem}.text-gray-500{--tw-text-opacity:1;color:rgb(107 114 128/var(--tw-text-opacity))}.shadow,.shadow-md{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-md{--tw-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color)}.duration-300{transition-duration:.3s}.before\\:absolute:before{content:var(--tw-content);position:absolute}.before\\:-top-4:before{content:var(--tw-content);top:-1rem}.before\\:start-0:before{content:var(--tw-content);inset-inline-start:0}.before\\:h-4:before{content:var(--tw-content);height:1rem}.before\\:w-full:before{content:var(--tw-content);width:100%}.after\\:absolute:after{content:var(--tw-content);position:absolute}.after\\:-bottom-4:after{bottom:-1rem;content:var(--tw-content)}.after\\:start-0:after{content:var(--tw-content);inset-inline-start:0}.after\\:h-4:after{content:var(--tw-content);height:1rem}.after\\:w-full:after{content:var(--tw-content);width:100%}.disabled\\:pointer-events-none:disabled{pointer-events:none}.disabled\\:opacity-50:disabled{opacity:.5}:is(.dark .dark\\:border-transparent){border-color:transparent}.pointer-events-none{pointer-events:none}.inset-y-0{bottom:0;top:0}.mx-auto{margin-left:auto;margin-right:auto}.mb-0{margin-bottom:0}.mb-0\\.5{margin-bottom:.125rem}.mb-2{margin-bottom:.5rem}.inline-block{display:inline-block}.inline-flex{display:inline-flex}.max-w-52{max-width:13rem}.max-w-96{max-width:24rem}.animate-spin{animation:spin 1s linear infinite}.gap-x-2{column-gap:.5rem}.border-\\[3px\\]{border-width:3px}.border-current{border-color:currentColor}.border-t-transparent{border-top-color:transparent}.p-4{padding:1rem}.py-2\\.5{padding-bottom:.625rem;padding-top:.625rem}.pe-4{padding-inline-end:1rem}.ps-11{padding-inline-start:2.75rem}.ps-4{padding-inline-start:1rem}.pt-2{padding-top:.5rem}.pt-3{padding-top:.75rem}.text-center{text-align:center}.text-2xl{font-size:1.5rem;line-height:2rem}.font-medium{font-weight:500}.text-blue-400{--tw-text-opacity:1;color:rgb(96 165 250/var(--tw-text-opacity))}.text-slate-900{--tw-text-opacity:1;color:rgb(15 23 42/var(--tw-text-opacity))}.peer:disabled~.peer-disabled\\:pointer-events-none{pointer-events:none}.peer:disabled~.peer-disabled\\:opacity-50{opacity:.5}:is(.dark .dark\\:text-gray-300){--tw-text-opacity:1;color:rgb(209 213 219/var(--tw-text-opacity))}:is(.dark .dark\\:focus\\:outline-none:focus){outline:2px solid transparent;outline-offset:2px}:is(.dark .dark\\:focus\\:ring-1:focus){--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}:is(.dark .dark\\:focus\\:ring-gray-600:focus){--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.max-w-72{max-width:18rem}.pb-5{padding-bottom:1.25rem}.text-4xl{font-size:2.25rem;line-height:2.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-xs{font-size:.75rem;line-height:1rem}.uppercase{text-transform:uppercase}.before\\:me-6:before{content:var(--tw-content);margin-inline-end:1.5rem}.before\\:flex-\\[1_1_0\\%\\]:before{content:var(--tw-content);flex:1 1 0%}.before\\:border-t:before{border-top-width:1px;content:var(--tw-content)}.after\\:ms-6:after{content:var(--tw-content);margin-inline-start:1.5rem}.after\\:flex-\\[1_1_0\\%\\]:after{content:var(--tw-content);flex:1 1 0%}.after\\:border-t:after{border-top-width:1px;content:var(--tw-content)}.h-12{height:3rem}.w-12{width:3rem}.text-green-800{--tw-text-opacity:1;color:rgb(22 101 52/var(--tw-text-opacity))}:is(.dark .dark\\:text-green-200){--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}";
    const NlSelectStyle0 = nlSelectCss;

    const NlSelect = /*@__PURE__*/ proxyCustomElement(class NlSelect extends H {
        constructor() {
            super();
            this.__registerHost();
            this.__attachShadow();
            this.selectDomain = createEvent(this, "selectDomain", 7);
            this.isOpen = false;
            this.value = null;
            this.options = undefined;
            this.selected = undefined;
            this.mode = false;
            this.darkMode = false;
            this.themeState = 'default';
            this.theme = 'default';
        }
        handleWindowClick() {
            if (this.wrapperRef.querySelector('.listClass')) {
                this.isOpen = false;
            }
        }
        toggleDropdown() {
            this.isOpen = !this.isOpen;
            this.calculateDropdownPosition();
        }
        watchPropHandler(newValue) {
            this.themeState = newValue;
        }
        watchModeHandler(newValue) {
            this.mode = newValue;
        }
        connectedCallback() {
            this.themeState = this.theme;
            this.mode = this.darkMode;
            this.value = this.options[this.selected];
            this.selectDomain.emit(this.value.value);
        }
        calculateDropdownPosition() {
            if (this.isOpen && this.buttonRef) {
                const buttonRect = this.buttonRef.getBoundingClientRect();
                this.ulRef.style.top = `${buttonRect.height}px`;
            }
        }
        handleChange(el) {
            this.value = el;
            this.isOpen = false;
            this.selectDomain.emit(this.value.value);
        }
        render() {
            const listClass = `${this.isOpen ? 'listClass' : 'hidden'} min-w-[15rem] nl-select-list absolute left-0 shadow-md rounded-lg p-2 mt-1 after:h-4 after:absolute after:-bottom-4 after:start-0 after:w-full before:h-4 before:absolute before:-top-4 before:start-0 before:w-full`;
            const arrowClass = `${this.isOpen ? 'rotate-180' : 'rotate-0'} duration-300 flex-shrink-0 w-4 h-4 text-gray-500`;
            return (h("div", { class: `theme-${this.themeState}` }, h("div", { class: this.mode && 'dark' }, h("div", { class: "relative", ref: el => (this.wrapperRef = el) }, h("button", { ref: el => (this.buttonRef = el), onClick: () => this.toggleDropdown(), type: "button", class: "nl-select peer py-3 px-4 flex items-center w-full justify-between border-transparent rounded-lg text-sm disabled:opacity-50 disabled:pointer-events-none dark:border-transparent" }, h("span", { class: "truncate overflow-hidden" }, this.value.name), h("svg", { class: arrowClass, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, h("path", { d: "m6 9 6 6 6-6" }))), h("ul", { ref: el => (this.ulRef = el), class: listClass }, this.options.map(el => {
                return (h("li", { onClick: () => this.handleChange(el), class: "nl-select-option flex cursor-pointer items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm" }, el.name));
            }))))));
        }
        get element() { return this; }
        static get watchers() { return {
            "theme": ["watchPropHandler"],
            "darkMode": ["watchModeHandler"]
        }; }
        static get style() { return NlSelectStyle0; }
    }, [1, "nl-select", {
            "options": [16],
            "selected": [2],
            "darkMode": [4, "dark-mode"],
            "theme": [1],
            "isOpen": [32],
            "value": [32],
            "mode": [32],
            "themeState": [32]
        }, [[8, "click", "handleWindowClick"]], {
            "theme": ["watchPropHandler"],
            "darkMode": ["watchModeHandler"]
        }]);
    function defineCustomElement$3() {
        if (typeof customElements === "undefined") {
            return;
        }
        const components = ["nl-select"];
        components.forEach(tagName => { switch (tagName) {
            case "nl-select":
                if (!customElements.get(tagName)) {
                    customElements.define(tagName, NlSelect);
                }
                break;
        } });
    }
    defineCustomElement$3();

    const NlWelcomeThemplate = ({ handleClickToSignIn, handleClickToSignUp, title = 'Welcome!', description = 'This app is part of the Nostr network. Log in with your Nostr account or join the network.', }) => {
        return (h("div", null,
            h("div", { class: "p-4 overflow-y-auto" },
                h("h1", { class: "nl-title font-bold text-center text-4xl" }, title),
                h("p", { class: "nl-description font-light text-center text-lg pt-2 max-w-96 mx-auto" }, description)),
            h("div", { class: "max-w-52 mx-auto pb-5" },
                h("button", { onClick: handleClickToSignIn, type: "button", class: "nl-button py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" },
                    h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-4 h-4" },
                        h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" })),
                    "Log in"),
                h("div", { class: "nl-divider py-3 flex items-center text-xs uppercase before:flex-[1_1_0%] before:border-t before:me-6 after:flex-[1_1_0%] after:border-t  after:ms-6" }, "Or"),
                h("button", { onClick: handleClickToSignUp, type: "button", class: "nl-button py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" },
                    h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-4 h-4" },
                        h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" })),
                    "Sign up"))));
    };

    const NlSignupThemplate = ({ handleInputChange, handleDomainSelect, handleClickToSignIn, isFetching = false, handleCreateAccount, title = 'Sign up', description = 'Join the Nostr network.', error = '', theme, darkMode, isAvailable, servers, }) => {
        // const classError = ` text-sm ${isAvailable ? 'nl-text-success' : 'nl-text-error'} mb-2`;
        // const textError = isAvailable ? 'Available' : inputStatus;
        return (h("div", null,
            h("div", { class: "p-4 overflow-y-auto" },
                h("h1", { class: "nl-title font-bold text-center text-2xl" }, title),
                h("p", { class: "nl-description font-light text-center text-sm pt-2 max-w-96 mx-auto" }, description)),
            h("div", { class: "max-w-52 mx-auto" },
                h("div", { class: "relative mb-0.5" },
                    h("input", { onInput: handleInputChange, type: "text", class: "nl-input peer py-3 px-4 ps-11 block w-full border-transparent rounded-lg text-sm disabled:opacity-50 disabled:pointer-events-none dark:border-transparent", placeholder: "Name" }),
                    h("div", { class: "absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4 peer-disabled:opacity-50 peer-disabled:pointer-events-none" },
                        h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "2", stroke: isAvailable ? '#00cc00' : 'currentColor', class: "flex-shrink-0 w-4 h-4 text-gray-500" },
                            h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" })))),
                h("div", { class: "mb-0.5" },
                    h("nl-select", { onSelectDomain: handleDomainSelect, theme: theme, darkMode: darkMode, selected: 0, options: servers })),
                h("p", { class: "nl-title font-light text-sm mb-2" }, "Choose a service to manage your Nostr keys."),
                h("button", { disabled: isFetching, onClick: handleCreateAccount, type: "button", class: "nl-button py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" },
                    isFetching ? (h("span", { class: "animate-spin inline-block w-4 h-4 border-[3px] border-current border-t-transparent text-slate-900 dark:text-gray-300 rounded-full", role: "status", "aria-label": "loading" })) : (h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-4 h-4" },
                        h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" }))),
                    "Create an account")),
            h("div", { class: "ps-4 pe-4 overflow-y-auto" },
                h("p", { class: "nl-error font-light text-center text-sm max-w-96 mx-auto" }, error)),
            h("div", { class: "p-4 overflow-y-auto" },
                h("p", { class: "nl-footer font-light text-center text-sm pt-3 max-w-96 mx-auto" },
                    "If you already have an account please",
                    ' ',
                    h("span", { onClick: () => handleClickToSignIn(), class: "cursor-pointer text-blue-400" }, "log in"),
                    "."))));
    };

    const NlInfoThemplate = ({ handleClickToBack }) => {
        return (h("div", { class: "p-4" },
            h("button", { onClick: () => handleClickToBack(), type: "button", class: "nl-action-button flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent  dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600", "data-hs-overlay": "#hs-vertically-centered-modal" },
                h("span", { class: "sr-only" }, "Back"),
                h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-5 h-5" },
                    h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" }))),
            h("div", { class: "p-4 overflow-y-auto" },
                h("svg", { class: "w-12 h-12 mx-auto mb-2", width: "225", height: "224", viewBox: "0 0 225 224", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                    h("rect", { width: "224.047", height: "224", rx: "64", fill: "#6951FA" }),
                    h("path", { d: "M162.441 135.941V88.0593C170.359 85.1674 176 77.5348 176 68.6696C176 57.2919 166.708 48 155.33 48C143.953 48 134.661 57.2444 134.661 68.6696C134.661 77.5822 140.302 85.1674 148.219 88.0593V135.941C147.698 136.13 147.176 136.367 146.655 136.604L87.3956 77.3452C88.6282 74.6904 89.2919 71.7511 89.2919 68.6696C89.2919 57.2444 80.0474 48 68.6696 48C57.2919 48 48 57.2444 48 68.6696C48 77.5822 53.6415 85.1674 61.5585 88.0593V135.941C53.6415 138.833 48 146.465 48 155.33C48 166.708 57.2444 176 68.6696 176C80.0948 176 89.3393 166.708 89.3393 155.33C89.3393 146.418 83.6978 138.833 75.7807 135.941V88.0593C76.3022 87.8696 76.8237 87.6326 77.3452 87.3956L136.604 146.655C135.372 149.31 134.708 152.249 134.708 155.33C134.708 166.708 143.953 176 155.378 176C166.803 176 176.047 166.708 176.047 155.33C176.047 146.418 170.406 138.833 162.489 135.941H162.441Z", fill: "white" })),
                h("h1", { class: "nl-title font-bold text-center text-4xl" },
                    "Nostr ",
                    h("span", { class: "font-light" }, "Login")),
                h("p", { class: "text-green-800 dark:text-green-200 font-light text-center text-lg pt-2 max-w-96 mx-auto" }, "Version: 1.0.18"),
                h("p", { class: "nl-description font-light text-center text-lg pt-2 max-w-96 mx-auto" },
                    "Learn more about Nostr",
                    ' ',
                    h("a", { target: "_blank", href: "https://nostr.how" }, "here"),
                    ".",
                    h("br", null),
                    "This is an",
                    ' ',
                    h("a", { target: "_blank", href: "https://github.com/nostrband/nostr-login" }, "open-source"),
                    ' ',
                    "tool by",
                    ' ',
                    h("a", { target: "_blank", href: "https://nostr.band" }, "Nostr.Band"),
                    "."))));
    };

    const NlSigninThemplate = ({ handleInputChange, handleLogin, title = 'Log in', description = 'Please enter your user name.', handleClickToSignUp, isFetchLogin = false, isGood = false, error = '', }) => {
        return (h("div", null,
            h("div", { class: "p-4 overflow-y-auto" },
                h("h1", { class: "nl-title font-bold text-center text-2xl" }, title),
                h("p", { class: "nl-description font-light text-center text-sm pt-2 max-w-96 mx-auto" }, description)),
            h("div", { class: "max-w-72 mx-auto" },
                h("div", { class: "relative mb-2" },
                    h("input", { onInput: handleInputChange, type: "text", class: "nl-input peer py-3 px-4 ps-11 block w-full border-transparent rounded-lg text-sm disabled:opacity-50 disabled:pointer-events-none dark:border-transparent", placeholder: "name@domain.com" }),
                    h("div", { class: "absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4 peer-disabled:opacity-50 peer-disabled:pointer-events-none" },
                        h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "2", stroke: isGood ? '#00cc00' : 'currentColor', class: "flex-shrink-0 w-4 h-4 text-gray-500" },
                            h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" })))),
                h("button", { disabled: isFetchLogin, onClick: handleLogin, type: "button", class: "nl-button py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" },
                    isFetchLogin ? (h("span", { class: "animate-spin inline-block w-4 h-4 border-[3px] border-current border-t-transparent text-slate-900 dark:text-gray-300 rounded-full", role: "status", "aria-label": "loading" })) : (h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-4 h-4" },
                        h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" }))),
                    "Log in")),
            h("div", { class: "ps-4 pe-4 overflow-y-auto" },
                h("p", { class: "nl-error font-light text-center text-sm max-w-96 mx-auto" }, error)),
            h("div", { class: "p-4 overflow-y-auto" },
                h("p", { class: "nl-footer font-light text-center text-sm pt-3 max-w-96 mx-auto" },
                    "If you don't have an account please",
                    ' ',
                    h("span", { onClick: handleClickToSignUp, class: "cursor-pointer text-blue-400" }, "sign up"),
                    "."))));
    };

    const nlAuthCss = "/*! tailwindcss v3.4.1 | MIT License | https://tailwindcss.com*/*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;border:0 solid #e5e7eb;box-sizing:border-box}:after,:before{--tw-content:\"\"}:host,html{-webkit-text-size-adjust:100%;font-feature-settings:normal;-webkit-tap-highlight-color:transparent;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-variation-settings:normal;line-height:1.5;-moz-tab-size:4;tab-size:4}body{line-height:inherit;margin:0}hr{border-top-width:1px;color:inherit;height:0}abbr:where([title]){text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-feature-settings:normal;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em;font-variation-settings:normal}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{border-collapse:collapse;border-color:inherit;text-indent:0}button,input,optgroup,select,textarea{font-feature-settings:inherit;color:inherit;font-family:inherit;font-size:100%;font-variation-settings:inherit;font-weight:inherit;line-height:inherit;margin:0;padding:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,fieldset,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::placeholder,textarea::placeholder{color:#9ca3af;color:#6b7280;opacity:1}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{height:auto;max-width:100%}[hidden]{display:none}[multiple],[type=date],[type=datetime-local],[type=email],[type=month],[type=number],[type=password],[type=search],[type=tel],[type=text],[type=time],[type=url],[type=week],input:where(:not([type])),select,textarea{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;border-color:#6b7280;border-radius:0;border-width:1px;font-size:1rem;line-height:1.5rem;padding:.5rem .75rem}[multiple]:focus,[type=date]:focus,[type=datetime-local]:focus,[type=email]:focus,[type=month]:focus,[type=number]:focus,[type=password]:focus,[type=search]:focus,[type=tel]:focus,[type=text]:focus,[type=time]:focus,[type=url]:focus,[type=week]:focus,input:where(:not([type])):focus,select:focus,textarea:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);border-color:#2563eb;box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-date-and-time-value{min-height:1.5em;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-meridiem-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-year-field{padding-bottom:0;padding-top:0}select{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\");background-position:right .5rem center;background-repeat:no-repeat;background-size:1.5em 1.5em;padding-right:2.5rem;print-color-adjust:exact}[multiple],[size]:where(select:not([size=\"1\"])){background-image:none;background-position:0 0;background-repeat:unset;background-size:initial;padding-right:.75rem;print-color-adjust:unset}[type=checkbox],[type=radio]{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;background-origin:border-box;border-color:#6b7280;border-width:1px;color:#2563eb;display:inline-block;flex-shrink:0;height:1rem;padding:0;print-color-adjust:exact;user-select:none;vertical-align:middle;width:1rem}[type=checkbox]{border-radius:0}[type=radio]{border-radius:100%}[type=checkbox]:focus,[type=radio]:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:2px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}[type=checkbox]:checked,[type=radio]:checked{background-color:currentColor;background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}[type=checkbox]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=checkbox]:checked{appearance:auto}}[type=radio]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='8' cy='8' r='3'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=radio]:checked{appearance:auto}}[type=checkbox]:checked:focus,[type=checkbox]:checked:hover,[type=radio]:checked:focus,[type=radio]:checked:hover{background-color:currentColor;border-color:transparent}[type=checkbox]:indeterminate{background-color:currentColor;background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3E%3C/svg%3E\");background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}@media (forced-colors:active){[type=checkbox]:indeterminate{appearance:auto}}[type=checkbox]:indeterminate:focus,[type=checkbox]:indeterminate:hover{background-color:currentColor;border-color:transparent}[type=file]{background:unset;border-color:inherit;border-radius:0;border-width:0;font-size:unset;line-height:inherit;padding:0}[type=file]:focus{outline:1px solid ButtonText;outline:1px auto -webkit-focus-ring-color}::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;}.block{display:block}.theme-default .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-default .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-description,.theme-default .nl-logo,.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-description,.theme-default .dark .nl-logo,.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity))}.theme-default .nl-description a{--tw-text-opacity:1;color:rgb(30 64 175/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .dark .nl-description a{--tw-text-opacity:1;color:rgb(191 219 254/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .nl-action-button{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-action-button{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(249 250 251/var(--tw-bg-opacity))}.theme-default .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-divider{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .nl-divider:before{border-top-width:1px}.theme-default .nl-divider:after,.theme-default .nl-divider:before{--tw-border-opacity:1;border-color:rgb(229 231 235/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .dark .nl-divider{--tw-text-opacity:1;color:rgb(107 114 128/var(--tw-text-opacity))}.theme-default .dark .nl-divider:after,.theme-default .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(75 85 99/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .nl-footer{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-footer{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-default .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-default .nl-input{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-select-option{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(229 231 235/var(--tw-bg-opacity))}.theme-default .dark .nl-select-option{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-default .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-default .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-ocean .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(191 219 254/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-ocean .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(8 47 73/var(--tw-bg-opacity))}.theme-ocean .nl-description,.theme-ocean .nl-logo,.theme-ocean .nl-title{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-description,.theme-ocean .dark .nl-logo,.theme-ocean .dark .nl-title{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-action-button{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-action-button{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(224 242 254/var(--tw-bg-opacity));border-color:rgb(186 230 253/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 249 255/var(--tw-bg-opacity))}.theme-ocean .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));border-color:rgb(8 47 73/var(--tw-border-opacity));color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-divider{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-divider:after,.theme-ocean .nl-divider:before{--tw-border-opacity:1;border-color:rgb(8 47 73/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .dark .nl-divider{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-divider:after,.theme-ocean .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(186 230 253/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .nl-footer{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-footer{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-ocean .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-ocean .nl-input{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select-list{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(3 105 161/var(--tw-bg-opacity))}.theme-ocean .nl-select-option{--tw-text-opacity:1;color:rgb(7 89 133/var(--tw-text-opacity))}.theme-ocean .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(186 230 253/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-option{--tw-text-opacity:1;color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));color:rgb(125 211 252/var(--tw-text-opacity))}.theme-ocean .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-ocean .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-lemonade .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(187 247 208/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-lemonade .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(5 46 22/var(--tw-bg-opacity))}.theme-lemonade .nl-description,.theme-lemonade .nl-logo,.theme-lemonade .nl-title{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-description,.theme-lemonade .dark .nl-logo,.theme-lemonade .dark .nl-title{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-action-button{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-action-button{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(220 252 231/var(--tw-bg-opacity));border-color:rgb(187 247 208/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 253 244/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));border-color:rgb(5 46 22/var(--tw-border-opacity));color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-divider{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-divider:after,.theme-lemonade .nl-divider:before{--tw-border-opacity:1;border-color:rgb(5 46 22/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .dark .nl-divider{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-divider:after,.theme-lemonade .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(187 247 208/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .nl-footer{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-footer{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-lemonade .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-lemonade .nl-input{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select-list{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(21 128 61/var(--tw-bg-opacity))}.theme-lemonade .nl-select-option{--tw-text-opacity:1;color:rgb(22 101 52/var(--tw-text-opacity))}.theme-lemonade .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(187 247 208/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-option{--tw-text-opacity:1;color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));color:rgb(134 239 172/var(--tw-text-opacity))}.theme-lemonade .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-lemonade .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-purple .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(233 213 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-purple .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(59 7 100/var(--tw-bg-opacity))}.theme-purple .nl-description,.theme-purple .nl-logo,.theme-purple .nl-title{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-description,.theme-purple .dark .nl-logo,.theme-purple .dark .nl-title{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-action-button{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-action-button{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(243 232 255/var(--tw-bg-opacity));border-color:rgb(233 213 255/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(250 245 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));border-color:rgb(59 7 100/var(--tw-border-opacity));color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-divider{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-divider:after,.theme-purple .nl-divider:before{--tw-border-opacity:1;border-color:rgb(59 7 100/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .dark .nl-divider{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-divider:after,.theme-purple .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(233 213 255/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .nl-footer{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-footer{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-purple .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-purple .nl-input{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(126 34 206/var(--tw-bg-opacity))}.theme-purple .nl-select-option{--tw-text-opacity:1;color:rgb(107 33 168/var(--tw-text-opacity))}.theme-purple .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(233 213 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-option{--tw-text-opacity:1;color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));color:rgb(216 180 254/var(--tw-text-opacity))}.theme-purple .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-purple .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-purple .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-purple .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}:host{display:block}.sr-only{clip:rect(0,0,0,0);border-width:0;height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;white-space:nowrap;width:1px}.static{position:static}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.left-0{left:0}.start-0{inset-inline-start:0}.top-0{top:0}.z-\\[80\\]{z-index:80}.z-\\[81\\]{z-index:81}.flex{display:flex}.h-5{height:1.25rem}.h-7{height:1.75rem}.h-full{height:100%}.w-5{width:1.25rem}.w-7{width:1.75rem}.w-full{width:100%}.flex-shrink-0{flex-shrink:0}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-1{gap:.25rem}.gap-2{gap:.5rem}.overflow-y-auto{overflow-y:auto}.overflow-x-hidden{overflow-x:hidden}.rounded-full{border-radius:9999px}.rounded-xl{border-radius:.75rem}.border{border-width:1px}.border-transparent{border-color:transparent}.bg-gray-500{--tw-bg-opacity:1;background-color:rgb(107 114 128/var(--tw-bg-opacity))}.bg-opacity-75{--tw-bg-opacity:0.75}.px-4{padding-left:1rem;padding-right:1rem}.py-3{padding-bottom:.75rem;padding-top:.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.font-bold{font-weight:700}.font-light{font-weight:300}.font-semibold{font-weight:600}.shadow{--tw-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color),0 1px 2px -1px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}@media (min-width:640px){.sm\\:mx-auto{margin-left:auto;margin-right:auto}.sm\\:w-full{width:100%}.sm\\:max-w-lg{max-width:32rem}}.mt-1{margin-top:.25rem}.hidden{display:none}.h-4{height:1rem}.w-4{width:1rem}.min-w-\\[15rem\\]{min-width:15rem}.rotate-0{--tw-rotate:0deg}.rotate-0,.rotate-180{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.rotate-180{--tw-rotate:180deg}.cursor-pointer{cursor:pointer}.gap-x-3{column-gap:.75rem}.gap-x-3\\.5{column-gap:.875rem}.overflow-hidden,.truncate{overflow:hidden}.truncate{text-overflow:ellipsis;white-space:nowrap}.rounded-lg{border-radius:.5rem}.p-2{padding:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.py-2{padding-bottom:.5rem;padding-top:.5rem}.text-gray-500{--tw-text-opacity:1;color:rgb(107 114 128/var(--tw-text-opacity))}.shadow,.shadow-md{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-md{--tw-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color)}.duration-300{transition-duration:.3s}.before\\:absolute:before{content:var(--tw-content);position:absolute}.before\\:-top-4:before{content:var(--tw-content);top:-1rem}.before\\:start-0:before{content:var(--tw-content);inset-inline-start:0}.before\\:h-4:before{content:var(--tw-content);height:1rem}.before\\:w-full:before{content:var(--tw-content);width:100%}.after\\:absolute:after{content:var(--tw-content);position:absolute}.after\\:-bottom-4:after{bottom:-1rem;content:var(--tw-content)}.after\\:start-0:after{content:var(--tw-content);inset-inline-start:0}.after\\:h-4:after{content:var(--tw-content);height:1rem}.after\\:w-full:after{content:var(--tw-content);width:100%}.disabled\\:pointer-events-none:disabled{pointer-events:none}.disabled\\:opacity-50:disabled{opacity:.5}:is(.dark .dark\\:border-transparent){border-color:transparent}.pointer-events-none{pointer-events:none}.inset-y-0{bottom:0;top:0}.mx-auto{margin-left:auto;margin-right:auto}.mb-0{margin-bottom:0}.mb-0\\.5{margin-bottom:.125rem}.mb-2{margin-bottom:.5rem}.inline-block{display:inline-block}.inline-flex{display:inline-flex}.max-w-52{max-width:13rem}.max-w-96{max-width:24rem}.animate-spin{animation:spin 1s linear infinite}.gap-x-2{column-gap:.5rem}.border-\\[3px\\]{border-width:3px}.border-current{border-color:currentColor}.border-t-transparent{border-top-color:transparent}.p-4{padding:1rem}.py-2\\.5{padding-bottom:.625rem;padding-top:.625rem}.pe-4{padding-inline-end:1rem}.ps-11{padding-inline-start:2.75rem}.ps-4{padding-inline-start:1rem}.pt-2{padding-top:.5rem}.pt-3{padding-top:.75rem}.text-center{text-align:center}.text-2xl{font-size:1.5rem;line-height:2rem}.font-medium{font-weight:500}.text-blue-400{--tw-text-opacity:1;color:rgb(96 165 250/var(--tw-text-opacity))}.text-slate-900{--tw-text-opacity:1;color:rgb(15 23 42/var(--tw-text-opacity))}.peer:disabled~.peer-disabled\\:pointer-events-none{pointer-events:none}.peer:disabled~.peer-disabled\\:opacity-50{opacity:.5}:is(.dark .dark\\:text-gray-300){--tw-text-opacity:1;color:rgb(209 213 219/var(--tw-text-opacity))}:is(.dark .dark\\:focus\\:outline-none:focus){outline:2px solid transparent;outline-offset:2px}:is(.dark .dark\\:focus\\:ring-1:focus){--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}:is(.dark .dark\\:focus\\:ring-gray-600:focus){--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.max-w-72{max-width:18rem}.pb-5{padding-bottom:1.25rem}.text-4xl{font-size:2.25rem;line-height:2.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-xs{font-size:.75rem;line-height:1rem}.uppercase{text-transform:uppercase}.before\\:me-6:before{content:var(--tw-content);margin-inline-end:1.5rem}.before\\:flex-\\[1_1_0\\%\\]:before{content:var(--tw-content);flex:1 1 0%}.before\\:border-t:before{border-top-width:1px;content:var(--tw-content)}.after\\:ms-6:after{content:var(--tw-content);margin-inline-start:1.5rem}.after\\:flex-\\[1_1_0\\%\\]:after{content:var(--tw-content);flex:1 1 0%}.after\\:border-t:after{border-top-width:1px;content:var(--tw-content)}.h-12{height:3rem}.w-12{width:3rem}.text-green-800{--tw-text-opacity:1;color:rgb(22 101 52/var(--tw-text-opacity))}:is(.dark .dark\\:text-green-200){--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}";
    const NlAuthStyle0 = nlAuthCss;

    const NlAuth = /*@__PURE__*/ proxyCustomElement(class NlAuth extends H {
        constructor() {
            super();
            this.__registerHost();
            this.__attachShadow();
            this.nlLogin = createEvent(this, "nlLogin", 7);
            this.nlSignup = createEvent(this, "nlSignup", 7);
            this.nlCloseModal = createEvent(this, "nlCloseModal", 7);
            this.nlCheckLogin = createEvent(this, "nlCheckLogin", 7);
            this.nlCheckSignup = createEvent(this, "nlCheckSignup", 7);
            this.darkMode = false;
            this.themeState = 'default';
            this.theme = 'default';
            this.startScreen = CURRENT_MODULE.WELCOME;
            this.bunkers = 'nsec.app,highlighter.com';
            this.servers = [
                { name: '@nsec.app', value: 'nsec.app' },
                { name: '@highlighter.com', value: 'highlighter.com' },
            ];
            this.isFetchCreateAccount = false;
            this.isFetchLogin = false;
            this.currentModule = CURRENT_MODULE.WELCOME;
            this.prevModule = CURRENT_MODULE.WELCOME;
            this.loginName = '';
            this.signupName = '';
            this.domain = '';
            this.error = '';
            this.signupNameIsAvailable = false;
            this.loginIsGood = false;
        }
        formatServers(bunkers) {
            return bunkers.split(',').map(d => ({
                name: '@' + d,
                value: d,
            }));
        }
        watchBunkersHandler(newValue) {
            console.log('bunkers', newValue);
            this.servers = this.formatServers(newValue);
        }
        watchThemeHandler(newValue) {
            this.themeState = newValue;
        }
        isSignup() {
            return this.currentModule === CURRENT_MODULE.SIGNUP;
        }
        handleNip05() {
            if (this.isSignup()) {
                this.nlCheckSignup.emit(`${this.signupName}@${this.domain}`);
            }
            else {
                this.nlCheckLogin.emit(this.loginName);
            }
        }
        handleInputChange(event) {
            const value = event.target.value;
            //    console.log("check", value, event);
            if (this.isSignup())
                this.signupName = value;
            else
                this.loginName = value;
            this.handleNip05();
        }
        handleDomainSelect(event) {
            this.domain = event.detail;
            this.handleNip05();
        }
        handleClose() {
            this.nlCloseModal.emit();
        }
        handleLogin(e) {
            e.preventDefault();
            this.isFetchLogin = true;
            this.nlLogin.emit(this.loginName);
        }
        handleClickToSignIn() {
            this.error = '';
            this.currentModule = CURRENT_MODULE.SIGNIN;
            this.handleNip05();
        }
        handleClickToSignUp() {
            this.error = '';
            this.currentModule = CURRENT_MODULE.SIGNUP;
            this.handleNip05();
        }
        handleChangeTheme() {
            this.darkMode = !this.darkMode;
            localStorage.setItem('nl-dark-mode', `${this.darkMode}`);
        }
        handleClickToInfo() {
            if (this.currentModule !== CURRENT_MODULE.INFO) {
                this.prevModule = this.currentModule;
                this.currentModule = CURRENT_MODULE.INFO;
            }
        }
        handleClickToBack() {
            this.currentModule = this.prevModule;
        }
        componentWillLoad() {
            // console.log(this.startScreen);
            this.themeState = this.theme;
            this.servers = this.formatServers(this.bunkers);
            this.currentModule = this.startScreen;
            this.prevModule = this.startScreen;
            const getDarkMode = localStorage.getItem('nl-dark-mode');
            if (getDarkMode) {
                this.darkMode = JSON.parse(getDarkMode);
            }
            else {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    this.darkMode = true;
                }
                else {
                    this.darkMode = false;
                }
            }
        }
        handleCreateAccount(e) {
            e.preventDefault();
            this.isFetchCreateAccount = true;
            this.nlSignup.emit(`${this.signupName}@${this.domain}`);
        }
        render() {
            const classWrapper = `w-full h-full fixed top-0 start-0 z-[80] overflow-x-hidden overflow-y-auto flex items-center ${this.darkMode ? 'dark' : ''}`;
            const renderModule = () => {
                switch (this.currentModule) {
                    case CURRENT_MODULE.WELCOME:
                        return h(NlWelcomeThemplate, { handleClickToSignIn: () => this.handleClickToSignIn(), handleClickToSignUp: () => this.handleClickToSignUp() });
                    case CURRENT_MODULE.SIGNIN:
                        return (h(NlSigninThemplate, { handleInputChange: e => this.handleInputChange(e), isFetchLogin: this.isFetchLogin, handleClickToSignUp: () => this.handleClickToSignUp(), handleLogin: e => this.handleLogin(e), error: this.error, isGood: this.loginIsGood }));
                    case CURRENT_MODULE.SIGNUP:
                        return (h(NlSignupThemplate, { isFetching: this.isFetchCreateAccount, handleInputChange: e => this.handleInputChange(e), handleDomainSelect: d => this.handleDomainSelect(d), handleCreateAccount: e => this.handleCreateAccount(e), handleClickToSignIn: () => this.handleClickToSignIn(), isAvailable: this.signupNameIsAvailable, error: this.error, theme: this.themeState, darkMode: this.darkMode, servers: this.servers }));
                    case CURRENT_MODULE.INFO:
                        return h(NlInfoThemplate, { handleClickToBack: () => this.handleClickToBack() });
                    default:
                        return h(NlWelcomeThemplate, { handleClickToSignIn: () => this.handleClickToSignIn(), handleClickToSignUp: () => this.handleClickToSignUp() });
                }
            };
            return (h("div", { class: `theme-${this.themeState}` }, h("div", { class: classWrapper }, h("div", { onClick: () => this.handleClose(), class: "absolute top-0 left-0 w-full h-full bg-gray-500 bg-opacity-75 z-[80]" }), h("div", { class: "nl-bg relative z-[81] w-full flex flex-col rounded-xl sm:max-w-lg sm:w-full sm:mx-auto" }, h("div", { class: "flex justify-between items-center py-3 px-4" }, h("div", { class: "flex gap-2 items-center" }, h("svg", { class: "w-7 h-7", width: "225", height: "224", viewBox: "0 0 225 224", fill: "none", xmlns: "http://www.w3.org/2000/svg" }, h("rect", { width: "224.047", height: "224", rx: "64", fill: "#6951FA" }), h("path", { d: "M162.441 135.941V88.0593C170.359 85.1674 176 77.5348 176 68.6696C176 57.2919 166.708 48 155.33 48C143.953 48 134.661 57.2444 134.661 68.6696C134.661 77.5822 140.302 85.1674 148.219 88.0593V135.941C147.698 136.13 147.176 136.367 146.655 136.604L87.3956 77.3452C88.6282 74.6904 89.2919 71.7511 89.2919 68.6696C89.2919 57.2444 80.0474 48 68.6696 48C57.2919 48 48 57.2444 48 68.6696C48 77.5822 53.6415 85.1674 61.5585 88.0593V135.941C53.6415 138.833 48 146.465 48 155.33C48 166.708 57.2444 176 68.6696 176C80.0948 176 89.3393 166.708 89.3393 155.33C89.3393 146.418 83.6978 138.833 75.7807 135.941V88.0593C76.3022 87.8696 76.8237 87.6326 77.3452 87.3956L136.604 146.655C135.372 149.31 134.708 152.249 134.708 155.33C134.708 166.708 143.953 176 155.378 176C166.803 176 176.047 166.708 176.047 155.33C176.047 146.418 170.406 138.833 162.489 135.941H162.441Z", fill: "white" })), h("p", { class: "font-bold nl-logo" }, "Nostr ", h("span", { class: "font-light" }, "Login"))), h("div", { class: "flex gap-1" }, h("button", { onClick: () => this.handleClickToInfo(), type: "button", class: "nl-action-button flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent" }, h("span", { class: "sr-only" }, "Info"), h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-5 h-5" }, h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" }))), h("button", { onClick: () => this.handleClose(), type: "button", class: "nl-action-button flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent" }, h("span", { class: "sr-only" }, "Close"), h("svg", { class: "flex-shrink-0 w-5 h-5", xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, h("path", { d: "M18 6 6 18" }), h("path", { d: "m6 6 12 12" }))))), renderModule()))));
        }
        static get watchers() { return {
            "bunkers": ["watchBunkersHandler"],
            "theme": ["watchThemeHandler"]
        }; }
        static get style() { return NlAuthStyle0; }
    }, [1, "nl-auth", {
            "theme": [1],
            "startScreen": [1, "start-screen"],
            "bunkers": [1],
            "darkMode": [32],
            "themeState": [32],
            "servers": [32],
            "isFetchCreateAccount": [32],
            "isFetchLogin": [32],
            "currentModule": [32],
            "prevModule": [32],
            "loginName": [32],
            "signupName": [32],
            "domain": [32],
            "error": [32],
            "signupNameIsAvailable": [32],
            "loginIsGood": [32]
        }, undefined, {
            "bunkers": ["watchBunkersHandler"],
            "theme": ["watchThemeHandler"]
        }]);
    function defineCustomElement$2() {
        if (typeof customElements === "undefined") {
            return;
        }
        const components = ["nl-auth", "nl-select"];
        components.forEach(tagName => { switch (tagName) {
            case "nl-auth":
                if (!customElements.get(tagName)) {
                    customElements.define(tagName, NlAuth);
                }
                break;
            case "nl-select":
                if (!customElements.get(tagName)) {
                    defineCustomElement$3();
                }
                break;
        } });
    }
    defineCustomElement$2();

    const nlButtonCss = "/*! tailwindcss v3.4.1 | MIT License | https://tailwindcss.com*/*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;border:0 solid #e5e7eb;box-sizing:border-box}:after,:before{--tw-content:\"\"}:host,html{-webkit-text-size-adjust:100%;font-feature-settings:normal;-webkit-tap-highlight-color:transparent;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-variation-settings:normal;line-height:1.5;-moz-tab-size:4;tab-size:4}body{line-height:inherit;margin:0}hr{border-top-width:1px;color:inherit;height:0}abbr:where([title]){text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-feature-settings:normal;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em;font-variation-settings:normal}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{border-collapse:collapse;border-color:inherit;text-indent:0}button,input,optgroup,select,textarea{font-feature-settings:inherit;color:inherit;font-family:inherit;font-size:100%;font-variation-settings:inherit;font-weight:inherit;line-height:inherit;margin:0;padding:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,fieldset,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::placeholder,textarea::placeholder{color:#9ca3af;color:#6b7280;opacity:1}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{height:auto;max-width:100%}[hidden]{display:none}[multiple],[type=date],[type=datetime-local],[type=email],[type=month],[type=number],[type=password],[type=search],[type=tel],[type=text],[type=time],[type=url],[type=week],input:where(:not([type])),select,textarea{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;border-color:#6b7280;border-radius:0;border-width:1px;font-size:1rem;line-height:1.5rem;padding:.5rem .75rem}[multiple]:focus,[type=date]:focus,[type=datetime-local]:focus,[type=email]:focus,[type=month]:focus,[type=number]:focus,[type=password]:focus,[type=search]:focus,[type=tel]:focus,[type=text]:focus,[type=time]:focus,[type=url]:focus,[type=week]:focus,input:where(:not([type])):focus,select:focus,textarea:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);border-color:#2563eb;box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-date-and-time-value{min-height:1.5em;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-meridiem-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-year-field{padding-bottom:0;padding-top:0}select{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\");background-position:right .5rem center;background-repeat:no-repeat;background-size:1.5em 1.5em;padding-right:2.5rem;print-color-adjust:exact}[multiple],[size]:where(select:not([size=\"1\"])){background-image:none;background-position:0 0;background-repeat:unset;background-size:initial;padding-right:.75rem;print-color-adjust:unset}[type=checkbox],[type=radio]{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;background-origin:border-box;border-color:#6b7280;border-width:1px;color:#2563eb;display:inline-block;flex-shrink:0;height:1rem;padding:0;print-color-adjust:exact;user-select:none;vertical-align:middle;width:1rem}[type=checkbox]{border-radius:0}[type=radio]{border-radius:100%}[type=checkbox]:focus,[type=radio]:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:2px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}[type=checkbox]:checked,[type=radio]:checked{background-color:currentColor;background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}[type=checkbox]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=checkbox]:checked{appearance:auto}}[type=radio]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='8' cy='8' r='3'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=radio]:checked{appearance:auto}}[type=checkbox]:checked:focus,[type=checkbox]:checked:hover,[type=radio]:checked:focus,[type=radio]:checked:hover{background-color:currentColor;border-color:transparent}[type=checkbox]:indeterminate{background-color:currentColor;background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3E%3C/svg%3E\");background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}@media (forced-colors:active){[type=checkbox]:indeterminate{appearance:auto}}[type=checkbox]:indeterminate:focus,[type=checkbox]:indeterminate:hover{background-color:currentColor;border-color:transparent}[type=file]{background:unset;border-color:inherit;border-radius:0;border-width:0;font-size:unset;line-height:inherit;padding:0}[type=file]:focus{outline:1px solid ButtonText;outline:1px auto -webkit-focus-ring-color}::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;}.block{display:block}.theme-default .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-default .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-description,.theme-default .nl-logo,.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-description,.theme-default .dark .nl-logo,.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity))}.theme-default .nl-description a{--tw-text-opacity:1;color:rgb(30 64 175/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .dark .nl-description a{--tw-text-opacity:1;color:rgb(191 219 254/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .nl-action-button{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-action-button{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(249 250 251/var(--tw-bg-opacity))}.theme-default .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-divider{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .nl-divider:before{border-top-width:1px}.theme-default .nl-divider:after,.theme-default .nl-divider:before{--tw-border-opacity:1;border-color:rgb(229 231 235/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .dark .nl-divider{--tw-text-opacity:1;color:rgb(107 114 128/var(--tw-text-opacity))}.theme-default .dark .nl-divider:after,.theme-default .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(75 85 99/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .nl-footer{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-footer{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-default .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-default .nl-input{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-select-option{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(229 231 235/var(--tw-bg-opacity))}.theme-default .dark .nl-select-option{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-default .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-default .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-ocean .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(191 219 254/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-ocean .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(8 47 73/var(--tw-bg-opacity))}.theme-ocean .nl-description,.theme-ocean .nl-logo,.theme-ocean .nl-title{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-description,.theme-ocean .dark .nl-logo,.theme-ocean .dark .nl-title{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-action-button{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-action-button{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(224 242 254/var(--tw-bg-opacity));border-color:rgb(186 230 253/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 249 255/var(--tw-bg-opacity))}.theme-ocean .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));border-color:rgb(8 47 73/var(--tw-border-opacity));color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-divider{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-divider:after,.theme-ocean .nl-divider:before{--tw-border-opacity:1;border-color:rgb(8 47 73/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .dark .nl-divider{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-divider:after,.theme-ocean .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(186 230 253/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .nl-footer{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-footer{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-ocean .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-ocean .nl-input{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select-list{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(3 105 161/var(--tw-bg-opacity))}.theme-ocean .nl-select-option{--tw-text-opacity:1;color:rgb(7 89 133/var(--tw-text-opacity))}.theme-ocean .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(186 230 253/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-option{--tw-text-opacity:1;color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));color:rgb(125 211 252/var(--tw-text-opacity))}.theme-ocean .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-ocean .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-lemonade .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(187 247 208/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-lemonade .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(5 46 22/var(--tw-bg-opacity))}.theme-lemonade .nl-description,.theme-lemonade .nl-logo,.theme-lemonade .nl-title{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-description,.theme-lemonade .dark .nl-logo,.theme-lemonade .dark .nl-title{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-action-button{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-action-button{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(220 252 231/var(--tw-bg-opacity));border-color:rgb(187 247 208/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 253 244/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));border-color:rgb(5 46 22/var(--tw-border-opacity));color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-divider{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-divider:after,.theme-lemonade .nl-divider:before{--tw-border-opacity:1;border-color:rgb(5 46 22/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .dark .nl-divider{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-divider:after,.theme-lemonade .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(187 247 208/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .nl-footer{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-footer{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-lemonade .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-lemonade .nl-input{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select-list{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(21 128 61/var(--tw-bg-opacity))}.theme-lemonade .nl-select-option{--tw-text-opacity:1;color:rgb(22 101 52/var(--tw-text-opacity))}.theme-lemonade .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(187 247 208/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-option{--tw-text-opacity:1;color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));color:rgb(134 239 172/var(--tw-text-opacity))}.theme-lemonade .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-lemonade .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-purple .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(233 213 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-purple .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(59 7 100/var(--tw-bg-opacity))}.theme-purple .nl-description,.theme-purple .nl-logo,.theme-purple .nl-title{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-description,.theme-purple .dark .nl-logo,.theme-purple .dark .nl-title{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-action-button{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-action-button{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(243 232 255/var(--tw-bg-opacity));border-color:rgb(233 213 255/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(250 245 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));border-color:rgb(59 7 100/var(--tw-border-opacity));color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-divider{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-divider:after,.theme-purple .nl-divider:before{--tw-border-opacity:1;border-color:rgb(59 7 100/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .dark .nl-divider{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-divider:after,.theme-purple .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(233 213 255/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .nl-footer{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-footer{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-purple .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-purple .nl-input{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(126 34 206/var(--tw-bg-opacity))}.theme-purple .nl-select-option{--tw-text-opacity:1;color:rgb(107 33 168/var(--tw-text-opacity))}.theme-purple .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(233 213 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-option{--tw-text-opacity:1;color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));color:rgb(216 180 254/var(--tw-text-opacity))}.theme-purple .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-purple .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-purple .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-purple .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}:host{display:block}.static{position:static}.inline-flex{display:inline-flex}.w-full{width:100%}.items-center{align-items:center}.justify-center{justify-content:center}.gap-x-2{column-gap:.5rem}.rounded-lg{border-radius:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.py-2{padding-bottom:.5rem;padding-top:.5rem}.py-2\\.5{padding-bottom:.625rem;padding-top:.625rem}.text-sm{font-size:.875rem;line-height:1.25rem}.font-medium{font-weight:500}.shadow{--tw-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color),0 1px 2px -1px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.disabled\\:pointer-events-none:disabled{pointer-events:none}.disabled\\:opacity-50:disabled{opacity:.5}:is(.dark .dark\\:focus\\:outline-none:focus){outline:2px solid transparent;outline-offset:2px}:is(.dark .dark\\:focus\\:ring-1:focus){--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}:is(.dark .dark\\:focus\\:ring-gray-600:focus){--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}";
    const NlButtonStyle0 = nlButtonCss;

    const NlButton = /*@__PURE__*/ proxyCustomElement(class NlButton extends H {
        constructor() {
            super();
            this.__registerHost();
            this.__attachShadow();
            this.darkMode = false;
            this.themeState = 'default';
            this.nlTheme = 'default';
            this.titleBtn = 'Open modal';
        }
        watchPropHandler(newValue) {
            console.log(newValue);
            this.themeState = newValue;
        }
        connectedCallback() {
            this.themeState = this.nlTheme;
            const getDarkMode = localStorage.getItem('nl-dark-mode');
            if (getDarkMode) {
                this.darkMode = JSON.parse(getDarkMode);
            }
            else {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    this.darkMode = true;
                }
                else {
                    this.darkMode = false;
                }
            }
        }
        render() {
            return (h("div", { class: `theme-${this.themeState}` }, h("div", { class: this.darkMode && 'dark' }, h("button", { type: "button", class: "nl-button py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" }, this.titleBtn))));
        }
        static get watchers() { return {
            "theme": ["watchPropHandler"]
        }; }
        static get style() { return NlButtonStyle0; }
    }, [1, "nl-button", {
            "nlTheme": [1, "nl-theme"],
            "titleBtn": [1, "title-btn"],
            "darkMode": [32],
            "themeState": [32]
        }, undefined, {
            "theme": ["watchPropHandler"]
        }]);
    function defineCustomElement$1() {
        if (typeof customElements === "undefined") {
            return;
        }
        const components = ["nl-button"];
        components.forEach(tagName => { switch (tagName) {
            case "nl-button":
                if (!customElements.get(tagName)) {
                    customElements.define(tagName, NlButton);
                }
                break;
        } });
    }
    defineCustomElement$1();

    const nlBannerCss = "/*! tailwindcss v3.4.1 | MIT License | https://tailwindcss.com*/*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;border:0 solid #e5e7eb;box-sizing:border-box}:after,:before{--tw-content:\"\"}:host,html{-webkit-text-size-adjust:100%;font-feature-settings:normal;-webkit-tap-highlight-color:transparent;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-variation-settings:normal;line-height:1.5;-moz-tab-size:4;tab-size:4}body{line-height:inherit;margin:0}hr{border-top-width:1px;color:inherit;height:0}abbr:where([title]){text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-feature-settings:normal;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em;font-variation-settings:normal}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{border-collapse:collapse;border-color:inherit;text-indent:0}button,input,optgroup,select,textarea{font-feature-settings:inherit;color:inherit;font-family:inherit;font-size:100%;font-variation-settings:inherit;font-weight:inherit;line-height:inherit;margin:0;padding:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,fieldset,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::placeholder,textarea::placeholder{color:#9ca3af;color:#6b7280;opacity:1}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{height:auto;max-width:100%}[hidden]{display:none}[multiple],[type=date],[type=datetime-local],[type=email],[type=month],[type=number],[type=password],[type=search],[type=tel],[type=text],[type=time],[type=url],[type=week],input:where(:not([type])),select,textarea{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;border-color:#6b7280;border-radius:0;border-width:1px;font-size:1rem;line-height:1.5rem;padding:.5rem .75rem}[multiple]:focus,[type=date]:focus,[type=datetime-local]:focus,[type=email]:focus,[type=month]:focus,[type=number]:focus,[type=password]:focus,[type=search]:focus,[type=tel]:focus,[type=text]:focus,[type=time]:focus,[type=url]:focus,[type=week]:focus,input:where(:not([type])):focus,select:focus,textarea:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);border-color:#2563eb;box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-date-and-time-value{min-height:1.5em;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-meridiem-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-year-field{padding-bottom:0;padding-top:0}select{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\");background-position:right .5rem center;background-repeat:no-repeat;background-size:1.5em 1.5em;padding-right:2.5rem;print-color-adjust:exact}[multiple],[size]:where(select:not([size=\"1\"])){background-image:none;background-position:0 0;background-repeat:unset;background-size:initial;padding-right:.75rem;print-color-adjust:unset}[type=checkbox],[type=radio]{--tw-shadow:0 0 #0000;appearance:none;background-color:#fff;background-origin:border-box;border-color:#6b7280;border-width:1px;color:#2563eb;display:inline-block;flex-shrink:0;height:1rem;padding:0;print-color-adjust:exact;user-select:none;vertical-align:middle;width:1rem}[type=checkbox]{border-radius:0}[type=radio]{border-radius:100%}[type=checkbox]:focus,[type=radio]:focus{--tw-ring-inset:var(--tw-empty, );--tw-ring-offset-width:2px;--tw-ring-offset-color:#fff;--tw-ring-color:#2563eb;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow);outline:2px solid transparent;outline-offset:2px}[type=checkbox]:checked,[type=radio]:checked{background-color:currentColor;background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}[type=checkbox]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=checkbox]:checked{appearance:auto}}[type=radio]:checked{background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 16 16' fill='%23fff' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='8' cy='8' r='3'/%3E%3C/svg%3E\")}@media (forced-colors:active){[type=radio]:checked{appearance:auto}}[type=checkbox]:checked:focus,[type=checkbox]:checked:hover,[type=radio]:checked:focus,[type=radio]:checked:hover{background-color:currentColor;border-color:transparent}[type=checkbox]:indeterminate{background-color:currentColor;background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3E%3C/svg%3E\");background-position:50%;background-repeat:no-repeat;background-size:100% 100%;border-color:transparent}@media (forced-colors:active){[type=checkbox]:indeterminate{appearance:auto}}[type=checkbox]:indeterminate:focus,[type=checkbox]:indeterminate:hover{background-color:currentColor;border-color:transparent}[type=file]{background:unset;border-color:inherit;border-radius:0;border-width:0;font-size:unset;line-height:inherit;padding:0}[type=file]:focus{outline:1px solid ButtonText;outline:1px auto -webkit-focus-ring-color}::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scroll-snap-strictness:proximity;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;}.block{display:block}.transition{transition-duration:.15s;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-timing-function:cubic-bezier(.4,0,.2,1)}.theme-default .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-default .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-description,.theme-default .nl-logo,.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-description,.theme-default .dark .nl-logo,.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity))}.theme-default .nl-description a{--tw-text-opacity:1;color:rgb(30 64 175/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .dark .nl-description a{--tw-text-opacity:1;color:rgb(191 219 254/var(--tw-text-opacity));text-decoration-line:underline}.theme-default .nl-action-button{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-action-button{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-default .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-title{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-title{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(249 250 251/var(--tw-bg-opacity))}.theme-default .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity))}.theme-default .nl-divider{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .nl-divider:before{border-top-width:1px}.theme-default .nl-divider:after,.theme-default .nl-divider:before{--tw-border-opacity:1;border-color:rgb(229 231 235/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .dark .nl-divider{--tw-text-opacity:1;color:rgb(107 114 128/var(--tw-text-opacity))}.theme-default .dark .nl-divider:after,.theme-default .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(75 85 99/var(--tw-border-opacity));content:var(--tw-content)}.theme-default .nl-footer{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-footer{--tw-text-opacity:1;color:rgb(229 231 235/var(--tw-text-opacity))}.theme-default .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-default .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-default .nl-input{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-default .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity));color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}.theme-default .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 244 246/var(--tw-bg-opacity))}.theme-default .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(55 65 81/var(--tw-bg-opacity))}.theme-default .nl-select-option{--tw-text-opacity:1;color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(229 231 235/var(--tw-bg-opacity))}.theme-default .dark .nl-select-option{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity))}.theme-default .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(31 41 55/var(--tw-bg-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-default .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-default .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-default .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(255 255 255/var(--tw-bg-opacity));border-color:rgb(229 231 235/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(31 41 55/var(--tw-text-opacity))}.theme-default .dark .nl-banner{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity));border-color:rgb(55 65 81/var(--tw-border-opacity));color:rgb(209 213 219/var(--tw-text-opacity))}.theme-ocean .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(191 219 254/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-ocean .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(8 47 73/var(--tw-bg-opacity))}.theme-ocean .nl-description,.theme-ocean .nl-logo,.theme-ocean .nl-title{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-description,.theme-ocean .dark .nl-logo,.theme-ocean .dark .nl-title{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-action-button{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-action-button{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-ocean .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(224 242 254/var(--tw-bg-opacity));border-color:rgb(186 230 253/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 249 255/var(--tw-bg-opacity))}.theme-ocean .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));border-color:rgb(8 47 73/var(--tw-border-opacity));color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity))}.theme-ocean .nl-divider{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .nl-divider:after,.theme-ocean .nl-divider:before{--tw-border-opacity:1;border-color:rgb(8 47 73/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .dark .nl-divider{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .dark .nl-divider:after,.theme-ocean .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(186 230 253/var(--tw-border-opacity));content:var(--tw-content)}.theme-ocean .nl-footer{--tw-text-opacity:1;color:rgb(8 47 73/var(--tw-text-opacity))}.theme-ocean .dark .nl-footer{--tw-text-opacity:1;color:rgb(186 230 253/var(--tw-text-opacity))}.theme-ocean .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-ocean .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-ocean .nl-input{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(14 165 233/var(--tw-ring-opacity));border-color:rgb(14 165 233/var(--tw-border-opacity))}.theme-ocean .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(12 74 110/var(--tw-bg-opacity));color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(2 132 199/var(--tw-ring-opacity))}.theme-ocean .nl-select-list{--tw-bg-opacity:1;background-color:rgb(224 242 254/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(3 105 161/var(--tw-bg-opacity))}.theme-ocean .nl-select-option{--tw-text-opacity:1;color:rgb(7 89 133/var(--tw-text-opacity))}.theme-ocean .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(186 230 253/var(--tw-bg-opacity))}.theme-ocean .dark .nl-select-option{--tw-text-opacity:1;color:rgb(56 189 248/var(--tw-text-opacity))}.theme-ocean .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(7 89 133/var(--tw-bg-opacity));color:rgb(125 211 252/var(--tw-text-opacity))}.theme-ocean .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-ocean .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-ocean .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-lemonade .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(187 247 208/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-lemonade .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(5 46 22/var(--tw-bg-opacity))}.theme-lemonade .nl-description,.theme-lemonade .nl-logo,.theme-lemonade .nl-title{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-description,.theme-lemonade .dark .nl-logo,.theme-lemonade .dark .nl-title{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-action-button{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-action-button{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-lemonade .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(220 252 231/var(--tw-bg-opacity));border-color:rgb(187 247 208/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(240 253 244/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));border-color:rgb(5 46 22/var(--tw-border-opacity));color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity))}.theme-lemonade .nl-divider{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .nl-divider:after,.theme-lemonade .nl-divider:before{--tw-border-opacity:1;border-color:rgb(5 46 22/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .dark .nl-divider{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .dark .nl-divider:after,.theme-lemonade .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(187 247 208/var(--tw-border-opacity));content:var(--tw-content)}.theme-lemonade .nl-footer{--tw-text-opacity:1;color:rgb(5 46 22/var(--tw-text-opacity))}.theme-lemonade .dark .nl-footer{--tw-text-opacity:1;color:rgb(187 247 208/var(--tw-text-opacity))}.theme-lemonade .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-lemonade .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-lemonade .nl-input{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(34 197 94/var(--tw-ring-opacity));border-color:rgb(34 197 94/var(--tw-border-opacity))}.theme-lemonade .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(20 83 45/var(--tw-bg-opacity));color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(22 163 74/var(--tw-ring-opacity))}.theme-lemonade .nl-select-list{--tw-bg-opacity:1;background-color:rgb(220 252 231/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(21 128 61/var(--tw-bg-opacity))}.theme-lemonade .nl-select-option{--tw-text-opacity:1;color:rgb(22 101 52/var(--tw-text-opacity))}.theme-lemonade .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(187 247 208/var(--tw-bg-opacity))}.theme-lemonade .dark .nl-select-option{--tw-text-opacity:1;color:rgb(74 222 128/var(--tw-text-opacity))}.theme-lemonade .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(22 101 52/var(--tw-bg-opacity));color:rgb(134 239 172/var(--tw-text-opacity))}.theme-lemonade .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-lemonade .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-lemonade .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}.theme-purple .nl-bg{--tw-bg-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(233 213 255/var(--tw-bg-opacity));box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.theme-purple .dark .nl-bg{--tw-bg-opacity:1;--tw-shadow-color:rgba(51,65,85,.7);--tw-shadow:var(--tw-shadow-colored);background-color:rgb(59 7 100/var(--tw-bg-opacity))}.theme-purple .nl-description,.theme-purple .nl-logo,.theme-purple .nl-title{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-description,.theme-purple .dark .nl-logo,.theme-purple .dark .nl-title{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-action-button{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-action-button{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity));outline:2px solid transparent;outline-offset:2px}.theme-purple .dark .nl-action-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);background-color:rgb(243 232 255/var(--tw-bg-opacity));border-color:rgb(233 213 255/var(--tw-border-opacity));border-width:1px;box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow);color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(250 245 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-button{--tw-border-opacity:1;--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));border-color:rgb(59 7 100/var(--tw-border-opacity));color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-button:hover{--tw-bg-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity))}.theme-purple .nl-divider{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .nl-divider:after,.theme-purple .nl-divider:before{--tw-border-opacity:1;border-color:rgb(59 7 100/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .dark .nl-divider{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .dark .nl-divider:after,.theme-purple .dark .nl-divider:before{--tw-border-opacity:1;border-color:rgb(233 213 255/var(--tw-border-opacity));content:var(--tw-content)}.theme-purple .nl-footer{--tw-text-opacity:1;color:rgb(59 7 100/var(--tw-text-opacity))}.theme-purple .dark .nl-footer{--tw-text-opacity:1;color:rgb(233 213 255/var(--tw-text-opacity))}.theme-purple .nl-error{--tw-text-opacity:1;color:rgb(153 27 27/var(--tw-text-opacity))}.theme-purple .dark .nl-error{--tw-text-opacity:1;color:rgb(254 202 202/var(--tw-text-opacity))}.theme-purple .nl-input{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-input:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-input{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-input:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .nl-select:focus{--tw-border-opacity:1;--tw-ring-opacity:1;--tw-ring-color:rgb(168 85 247/var(--tw-ring-opacity));border-color:rgb(168 85 247/var(--tw-border-opacity))}.theme-purple .dark .nl-select{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(88 28 135/var(--tw-bg-opacity));color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(147 51 234/var(--tw-ring-opacity))}.theme-purple .nl-select-list{--tw-bg-opacity:1;background-color:rgb(243 232 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-list{--tw-bg-opacity:1;background-color:rgb(126 34 206/var(--tw-bg-opacity))}.theme-purple .nl-select-option{--tw-text-opacity:1;color:rgb(107 33 168/var(--tw-text-opacity))}.theme-purple .nl-select-option:hover{--tw-bg-opacity:1;background-color:rgb(233 213 255/var(--tw-bg-opacity))}.theme-purple .dark .nl-select-option{--tw-text-opacity:1;color:rgb(192 132 252/var(--tw-text-opacity))}.theme-purple .dark .nl-select-option:hover{--tw-bg-opacity:1;--tw-text-opacity:1;background-color:rgb(107 33 168/var(--tw-bg-opacity));color:rgb(216 180 254/var(--tw-text-opacity))}.theme-purple .nl-text-error{--tw-text-opacity:1;color:rgb(220 38 38/var(--tw-text-opacity))}.theme-purple .dark .nl-text-error{--tw-text-opacity:1;color:rgb(248 113 113/var(--tw-text-opacity))}.theme-purple .nl-text-success{--tw-text-opacity:1;color:rgb(13 148 136/var(--tw-text-opacity))}.theme-purple .dark .nl-text-success{--tw-text-opacity:1;color:rgb(45 212 191/var(--tw-text-opacity))}:host{display:block}.show-slow{opacity:0;transition:.1s}.isOpen .show-slow{opacity:1;transition:.3s;transition-delay:.3s}.sr-only{clip:rect(0,0,0,0);border-width:0;height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;white-space:nowrap;width:1px}.static{position:static}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.right-0{right:0}.right-2{right:.5rem}.top-2{top:.5rem}.top-52{top:13rem}.z-0{z-index:0}.z-10{z-index:10}.z-20{z-index:20}.z-50{z-index:50}.m-auto{margin:auto}.mx-auto{margin-left:auto;margin-right:auto}.mb-2{margin-bottom:.5rem}.ml-0{margin-left:0}.ml-\\[2px\\]{margin-left:2px}.mr-0{margin-right:0}.mr-2{margin-right:.5rem}.mr-3{margin-right:.75rem}.mr-3\\.5{margin-right:.875rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.inline-block{display:inline-block}.flex{display:flex}.inline-flex{display:inline-flex}.h-0{height:0}.h-12{height:3rem}.h-4{height:1rem}.h-5{height:1.25rem}.h-6{height:1.5rem}.h-7{height:1.75rem}.h-8{height:2rem}.h-\\[46px\\]{height:46px}.h-auto{height:auto}.w-0{width:0}.w-12{width:3rem}.w-16{width:4rem}.w-4{width:1rem}.w-44{width:11rem}.w-5{width:1.25rem}.w-52{width:13rem}.w-6{width:1.5rem}.w-7{width:1.75rem}.w-8{width:2rem}.w-\\[48px\\]{width:48px}.w-full{width:100%}.min-w-40{min-width:10rem}.max-w-40{max-width:10rem}.flex-shrink-0{flex-shrink:0}@keyframes spin{to{transform:rotate(1turn)}}.animate-spin{animation:spin 1s linear infinite}.cursor-pointer{cursor:pointer}.items-center{align-items:center}.justify-center{justify-content:center}.gap-x-2{column-gap:.5rem}.overflow-hidden,.truncate{overflow:hidden}.truncate{text-overflow:ellipsis;white-space:nowrap}.text-nowrap{text-wrap:nowrap}.rounded-full{border-radius:9999px}.rounded-lg{border-radius:.5rem}.rounded-r-lg{border-bottom-right-radius:.5rem;border-top-right-radius:.5rem}.rounded-r-none{border-bottom-right-radius:0;border-top-right-radius:0}.border{border-width:1px}.border-\\[0px\\]{border-width:0}.border-\\[2px\\]{border-width:2px}.border-current{border-color:currentColor}.border-gray-200{--tw-border-opacity:1;border-color:rgb(229 231 235/var(--tw-border-opacity))}.border-transparent{border-color:transparent}.border-yellow-600{--tw-border-opacity:1;border-color:rgb(202 138 4/var(--tw-border-opacity))}.border-t-transparent{border-top-color:transparent}.bg-white{--tw-bg-opacity:1;background-color:rgb(255 255 255/var(--tw-bg-opacity))}.bg-yellow-100{--tw-bg-opacity:1;background-color:rgb(254 249 195/var(--tw-bg-opacity))}.p-2{padding:.5rem}.p-3{padding:.75rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.py-2{padding-bottom:.5rem;padding-top:.5rem}.py-2\\.5{padding-bottom:.625rem;padding-top:.625rem}.pl-\\[11px\\]{padding-left:11px}.text-center{text-align:center}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xs{font-size:.75rem;line-height:1rem}.font-bold{font-weight:700}.font-medium{font-weight:500}.font-semibold{font-weight:600}.uppercase{text-transform:uppercase}.text-slate-900{--tw-text-opacity:1;color:rgb(15 23 42/var(--tw-text-opacity))}.text-yellow-600{--tw-text-opacity:1;color:rgb(202 138 4/var(--tw-text-opacity))}.opacity-0{opacity:0}.shadow{--tw-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color),0 1px 2px -1px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.transition-all{transition-duration:.15s;transition-property:all;transition-timing-function:cubic-bezier(.4,0,.2,1)}.duration-300{transition-duration:.3s}.ease-in-out{transition-timing-function:cubic-bezier(.4,0,.2,1)}.hover\\:right-2:hover{right:.5rem}.hover\\:rounded-r-lg:hover{border-bottom-right-radius:.5rem;border-top-right-radius:.5rem}.disabled\\:pointer-events-none:disabled{pointer-events:none}.disabled\\:opacity-50:disabled{opacity:.5}:is(.dark .dark\\:text-gray-300){--tw-text-opacity:1;color:rgb(209 213 219/var(--tw-text-opacity))}:is(.dark .dark\\:focus\\:outline-none:focus){outline:2px solid transparent;outline-offset:2px}:is(.dark .dark\\:focus\\:ring-1:focus){--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}:is(.dark .dark\\:focus\\:ring-gray-600:focus){--tw-ring-opacity:1;--tw-ring-color:rgb(75 85 99/var(--tw-ring-opacity))}";
    const NlBannerStyle0 = nlBannerCss;

    const NlBanner = /*@__PURE__*/ proxyCustomElement(class NlBanner extends H {
        constructor() {
            super();
            this.__registerHost();
            this.__attachShadow();
            this.handleRetryConfirmBanner = createEvent(this, "handleRetryConfirmBanner", 7);
            this.handleNotifyConfirmBanner = createEvent(this, "handleNotifyConfirmBanner", 7);
            this.handleSetConfirmBanner = createEvent(this, "handleSetConfirmBanner", 7);
            this.handleLoginBanner = createEvent(this, "handleLoginBanner", 7);
            this.handleLogoutBanner = createEvent(this, "handleLogoutBanner", 7);
            this.handleOpenWelcomeModal = createEvent(this, "handleOpenWelcomeModal", 7);
            this.darkMode = false;
            this.isLogin = false;
            this.themeState = 'default';
            this.nlTheme = 'default';
            this.titleBanner = '';
            this.domain = '';
            this.urlNotify = '';
            this.listNotifies = [];
            this.isOpenNotifyTimeOut = false;
            this.isOpen = false;
            this.isConfirm = true;
            this.isOpenConfirm = false;
            this.isLoading = false;
            this.notify = null;
            this.isNotConfirmToSend = false;
            this.userInfo = null;
        }
        watchNotifyHandler(notify) {
            var _a, _b, _c;
            this.isNotConfirmToSend = true;
            this.isOpen = true;
            this.isOpenConfirm = true;
            this.domain = ((_c = (_b = (_a = this.userInfo) === null || _a === void 0 ? void 0 : _a.nip05) === null || _b === void 0 ? void 0 : _b.split('@')) === null || _c === void 0 ? void 0 : _c[1]) || '';
            if (notify.url) {
                this.urlNotify = notify.url;
                this.isOpenNotifyTimeOut = false;
            }
            if (!this.urlNotify && notify.timeOut) {
                this.isOpenNotifyTimeOut = true;
            }
        }
        watchPropHandler(newValue) {
            this.themeState = newValue;
        }
        connectedCallback() {
            this.themeState = this.nlTheme;
            const getDarkMode = localStorage.getItem('nl-dark-mode');
            if (getDarkMode) {
                this.darkMode = JSON.parse(getDarkMode);
            }
            else {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    this.darkMode = true;
                }
                else {
                    this.darkMode = false;
                }
            }
        }
        handleOpen() {
            if (this.userInfo) {
                this.isOpen = true;
            }
            else {
                this.handleOpenWelcomeModal.emit();
            }
        }
        handleClose() {
            this.isOpen = false;
            this.isOpenNotifyTimeOut = false;
            this.isOpenConfirm = false;
            if (this.isNotConfirmToSend) {
                this.handleSetConfirmBanner.emit(this.urlNotify);
                this.isNotConfirmToSend = false;
            }
            this.urlNotify = '';
        }
        handleLogin() {
            this.handleLoginBanner.emit(METHOD_MODULE.SIGNIN);
            this.handleClose();
        }
        handleSignup() {
            this.handleLoginBanner.emit(METHOD_MODULE.SIGNUP);
            this.handleClose();
        }
        handleLogout() {
            this.handleLogoutBanner.emit(METHOD_MODULE.LOGOUT);
            this.handleClose();
        }
        handleConfirm() {
            this.handleNotifyConfirmBanner.emit(this.urlNotify);
            this.isNotConfirmToSend = false;
            this.handleClose();
        }
        handleRetryConfirm() {
            this.handleRetryConfirmBanner.emit();
            this.isNotConfirmToSend = false;
            this.handleClose();
        }
        render() {
            var _a, _b, _c, _d, _e;
            const isShowImg = Boolean((_a = this.userInfo) === null || _a === void 0 ? void 0 : _a.picture);
            const userName = ((_d = (_c = (_b = this.userInfo) === null || _b === void 0 ? void 0 : _b.nip05) === null || _c === void 0 ? void 0 : _c.split('@')) === null || _d === void 0 ? void 0 : _d[0]) || ((_e = this.userInfo) === null || _e === void 0 ? void 0 : _e.pubkey) || '';
            const isShowUserName = Boolean(userName);
            return (h("div", { class: `theme-${this.themeState}` }, h("div", { class: this.darkMode && 'dark' }, h("div", { class: `nl-banner ${this.isOpen ? 'w-52 h-auto right-2 rounded-r-lg isOpen' : 'rounded-r-none hover:rounded-r-lg cursor-pointer'} z-50 w-12 h-12 fixed top-52 right-0 inline-block overflow-hidden gap-x-2 text-sm font-medium  rounded-lg hover:right-2  transition-all duration-300 ease-in-out` }, h("div", { class: "block w-[48px] h-[46px] relative z-10" }, h("div", { onClick: () => this.handleOpen(), class: "flex w-52 h-[46px] items-center pl-[11px]" }, h("span", { class: `${this.isLoading ? 'w-5 h-5 border-[2px] mr-3.5 ml-[2px] opacity-1' : 'w-0 h-0 border-[0px] mr-0 opacity-0 ml-0'} animate-spin transition-all duration-300 ease-in-out inline-block border-current border-t-transparent text-slate-900 dark:text-gray-300 rounded-full`, role: "status", "aria-label": "loading" }), this.userInfo ? (h("div", { class: "uppercase font-bold w-6 h-6 mr-2 rounded-full border border-gray-200 flex justify-center items-center" }, isShowImg ? (h("img", { class: "w-full rounded-full", src: this.userInfo.picture, alt: "Logo" })) : isShowUserName ? (userName[0]) : (h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "w-full" }, h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" }))))) : (h("div", { class: "flex justify-center items-center" }, h("svg", { class: "w-6 h-6", width: "225", height: "224", viewBox: "0 0 225 224", fill: "none", xmlns: "http://www.w3.org/2000/svg" }, h("rect", { width: "224.047", height: "224", rx: "64", fill: "#6951FA" }), h("path", { d: "M162.441 135.941V88.0593C170.359 85.1674 176 77.5348 176 68.6696C176 57.2919 166.708 48 155.33 48C143.953 48 134.661 57.2444 134.661 68.6696C134.661 77.5822 140.302 85.1674 148.219 88.0593V135.941C147.698 136.13 147.176 136.367 146.655 136.604L87.3956 77.3452C88.6282 74.6904 89.2919 71.7511 89.2919 68.6696C89.2919 57.2444 80.0474 48 68.6696 48C57.2919 48 48 57.2444 48 68.6696C48 77.5822 53.6415 85.1674 61.5585 88.0593V135.941C53.6415 138.833 48 146.465 48 155.33C48 166.708 57.2444 176 68.6696 176C80.0948 176 89.3393 166.708 89.3393 155.33C89.3393 146.418 83.6978 138.833 75.7807 135.941V88.0593C76.3022 87.8696 76.8237 87.6326 77.3452 87.3956L136.604 146.655C135.372 149.31 134.708 152.249 134.708 155.33C134.708 166.708 143.953 176 155.378 176C166.803 176 176.047 166.708 176.047 155.33C176.047 146.418 170.406 138.833 162.489 135.941H162.441Z", fill: "white" })), this.isOpen && (h("span", { class: "px-2" }, h("b", null, "Nostr"), " Login")))), isShowUserName && h("div", { class: "show-slow truncate w-16 text-xs" }, userName))), h("button", { onClick: () => this.handleClose(), type: "button", class: `${this.isOpen ? 'z-20' : 'z-0'} nl-action-button absolute right-2 top-2 z-0 show-slow flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent` }, h("span", { class: "sr-only" }, "Close"), h("svg", { class: "flex-shrink-0 w-5 h-5", xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, h("path", { d: "M18 6 6 18" }), h("path", { d: "m6 6 12 12" }))), h("div", { class: "p-3 show-slow" }, this.isOpenConfirm ? (h("div", null, h("div", { class: "w-8 h-8 p-1/2 rounded-full border border-gray-200 bg-white mb-2 mt-2 show-slow m-auto" }, h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "#5a68ff", class: "w-full" }, h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" }))), h("p", { class: "mb-2 text-center max-w-40 min-w-40 mx-auto" }, this.isOpenNotifyTimeOut ? 'Keys not responding, check your key storage app' : `Confirmation required at ${this.domain}`), this.isOpenNotifyTimeOut ? (h("a", { onClick: () => this.handleClose(), href: `https://${this.domain}`, target: "_blank", class: "nl-button text-nowrap py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" }, "Go to ", this.domain)) : (h("button", { onClick: () => this.handleConfirm(), type: "button", class: "nl-button text-nowrap py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" }, "Confirm")))) : (h("div", null, h("div", null, this.titleBanner && h("p", { class: "mb-2 text-center show-slow max-w-40 min-w-40 mx-auto" }, this.titleBanner), Boolean(this.listNotifies.length) && (h("div", { onClick: () => this.handleRetryConfirm(), class: "show-slow border border-yellow-600 text-yellow-600 bg-yellow-100 p-2 rounded-lg mb-2 cursor-pointer w-44 text-xs m-auto text-center" }, "Requests: ", this.listNotifies.length)), !this.userInfo ? (h("div", null, h("button", {
                // disabled={this.isLoading}
                onClick: () => this.handleLogin(), type: "button", class: "nl-button show-slow text-nowrap py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
            }, h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-4 h-4" }, h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" })), "Log in"), h("button", {
                // disabled={this.isLoading}
                onClick: () => this.handleSignup(), type: "button", class: "nl-button show-slow text-nowrap mt-3 py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
            }, h("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "flex-shrink-0 w-4 h-4" }, h("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" })), "Sign up"))) : (h("button", {
                // disabled={this.isLoading}
                onClick: () => this.handleLogout(), type: "button", class: "nl-button text-nowrap show-slow py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg  disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
            }, "Log out"))))))))));
        }
        static get watchers() { return {
            "notify": ["watchNotifyHandler"],
            "theme": ["watchPropHandler"]
        }; }
        static get style() { return NlBannerStyle0; }
    }, [1, "nl-banner", {
            "nlTheme": [1, "nl-theme"],
            "titleBanner": [1, "title-banner"],
            "listNotifies": [16],
            "isLoading": [4, "is-loading"],
            "notify": [16],
            "userInfo": [16],
            "darkMode": [32],
            "isLogin": [32],
            "themeState": [32],
            "domain": [32],
            "urlNotify": [32],
            "isOpenNotifyTimeOut": [32],
            "isOpen": [32],
            "isConfirm": [32],
            "isOpenConfirm": [32],
            "isNotConfirmToSend": [32]
        }, undefined, {
            "notify": ["watchNotifyHandler"],
            "theme": ["watchPropHandler"]
        }]);
    function defineCustomElement() {
        if (typeof customElements === "undefined") {
            return;
        }
        const components = ["nl-banner"];
        components.forEach(tagName => { switch (tagName) {
            case "nl-banner":
                if (!customElements.get(tagName)) {
                    customElements.define(tagName, NlBanner);
                }
                break;
        } });
    }
    defineCustomElement();

    function number$3(n) {
        if (!Number.isSafeInteger(n) || n < 0)
            throw new Error(`Wrong positive integer: ${n}`);
    }
    function bool$3(b) {
        if (typeof b !== 'boolean')
            throw new Error(`Expected boolean, not ${b}`);
    }
    function bytes$3(b, ...lengths) {
        if (!(b instanceof Uint8Array))
            throw new Error('Expected Uint8Array');
        if (lengths.length > 0 && !lengths.includes(b.length))
            throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
    }
    function hash$3(hash) {
        if (typeof hash !== 'function' || typeof hash.create !== 'function')
            throw new Error('Hash should be wrapped by utils.wrapConstructor');
        number$3(hash.outputLen);
        number$3(hash.blockLen);
    }
    function exists$3(instance, checkFinished = true) {
        if (instance.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (checkFinished && instance.finished)
            throw new Error('Hash#digest() has already been called');
    }
    function output$3(out, instance) {
        bytes$3(out);
        const min = instance.outputLen;
        if (out.length < min) {
            throw new Error(`digestInto() expects output buffer of length at least ${min}`);
        }
    }
    const assert$3 = {
        number: number$3,
        bool: bool$3,
        bytes: bytes$3,
        hash: hash$3,
        exists: exists$3,
        output: output$3,
    };

    const crypto$3 = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
    // node.js versions earlier than v19 don't declare it in global scope.
    // For node.js, package.json#exports field mapping rewrites import
    // from `crypto` to `cryptoNode`, which imports native module.
    // Makes the utils un-importable in browsers without a bundler.
    // Once node.js 18 is deprecated, we can just drop the import.
    const u8a$3 = (a) => a instanceof Uint8Array;
    // Cast array to view
    const createView$2 = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    // The rotate right (circular right shift) operation for uint32
    const rotr$2 = (word, shift) => (word << (32 - shift)) | (word >>> shift);
    // big-endian hardware is rare. Just in case someone still decides to run hashes:
    // early-throw an error because we don't support BE yet.
    const isLE$3 = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
    if (!isLE$3)
        throw new Error('Non little-endian hardware is not supported');
    Array.from({ length: 256 }, (v, i) => i.toString(16).padStart(2, '0'));
    /**
     * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
     */
    function utf8ToBytes$4(str) {
        if (typeof str !== 'string')
            throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
        return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
    }
    /**
     * Normalizes (non-hex) string or Uint8Array to Uint8Array.
     * Warning: when Uint8Array is passed, it would NOT get copied.
     * Keep in mind for future mutable operations.
     */
    function toBytes$3(data) {
        if (typeof data === 'string')
            data = utf8ToBytes$4(data);
        if (!u8a$3(data))
            throw new Error(`expected Uint8Array, got ${typeof data}`);
        return data;
    }
    /**
     * Copies several Uint8Arrays into one.
     */
    function concatBytes$3(...arrays) {
        const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
        let pad = 0; // walk through each item, ensure they have proper type
        arrays.forEach((a) => {
            if (!u8a$3(a))
                throw new Error('Uint8Array expected');
            r.set(a, pad);
            pad += a.length;
        });
        return r;
    }
    // For runtime check if class implements interface
    let Hash$2 = class Hash {
        // Safe version that clones internal state
        clone() {
            return this._cloneInto();
        }
    };
    function wrapConstructor$2(hashCons) {
        const hashC = (msg) => hashCons().update(toBytes$3(msg)).digest();
        const tmp = hashCons();
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = () => hashCons();
        return hashC;
    }
    /**
     * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
     */
    function randomBytes$2(bytesLength = 32) {
        if (crypto$3 && typeof crypto$3.getRandomValues === 'function') {
            return crypto$3.getRandomValues(new Uint8Array(bytesLength));
        }
        throw new Error('crypto.getRandomValues must be defined');
    }

    // Polyfill for Safari 14
    function setBigUint64$2(view, byteOffset, value, isLE) {
        if (typeof view.setBigUint64 === 'function')
            return view.setBigUint64(byteOffset, value, isLE);
        const _32n = BigInt(32);
        const _u32_max = BigInt(0xffffffff);
        const wh = Number((value >> _32n) & _u32_max);
        const wl = Number(value & _u32_max);
        const h = isLE ? 4 : 0;
        const l = isLE ? 0 : 4;
        view.setUint32(byteOffset + h, wh, isLE);
        view.setUint32(byteOffset + l, wl, isLE);
    }
    // Base SHA2 class (RFC 6234)
    let SHA2$2 = class SHA2 extends Hash$2 {
        constructor(blockLen, outputLen, padOffset, isLE) {
            super();
            this.blockLen = blockLen;
            this.outputLen = outputLen;
            this.padOffset = padOffset;
            this.isLE = isLE;
            this.finished = false;
            this.length = 0;
            this.pos = 0;
            this.destroyed = false;
            this.buffer = new Uint8Array(blockLen);
            this.view = createView$2(this.buffer);
        }
        update(data) {
            assert$3.exists(this);
            const { view, buffer, blockLen } = this;
            data = toBytes$3(data);
            const len = data.length;
            for (let pos = 0; pos < len;) {
                const take = Math.min(blockLen - this.pos, len - pos);
                // Fast path: we have at least one block in input, cast it to view and process
                if (take === blockLen) {
                    const dataView = createView$2(data);
                    for (; blockLen <= len - pos; pos += blockLen)
                        this.process(dataView, pos);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                pos += take;
                if (this.pos === blockLen) {
                    this.process(view, 0);
                    this.pos = 0;
                }
            }
            this.length += data.length;
            this.roundClean();
            return this;
        }
        digestInto(out) {
            assert$3.exists(this);
            assert$3.output(out, this);
            this.finished = true;
            // Padding
            // We can avoid allocation of buffer for padding completely if it
            // was previously not allocated here. But it won't change performance.
            const { buffer, view, blockLen, isLE } = this;
            let { pos } = this;
            // append the bit '1' to the message
            buffer[pos++] = 0b10000000;
            this.buffer.subarray(pos).fill(0);
            // we have less than padOffset left in buffer, so we cannot put length in current block, need process it and pad again
            if (this.padOffset > blockLen - pos) {
                this.process(view, 0);
                pos = 0;
            }
            // Pad until full block byte with zeros
            for (let i = pos; i < blockLen; i++)
                buffer[i] = 0;
            // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
            // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
            // So we just write lowest 64 bits of that value.
            setBigUint64$2(view, blockLen - 8, BigInt(this.length * 8), isLE);
            this.process(view, 0);
            const oview = createView$2(out);
            const len = this.outputLen;
            // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
            if (len % 4)
                throw new Error('_sha2: outputLen should be aligned to 32bit');
            const outLen = len / 4;
            const state = this.get();
            if (outLen > state.length)
                throw new Error('_sha2: outputLen bigger than state');
            for (let i = 0; i < outLen; i++)
                oview.setUint32(4 * i, state[i], isLE);
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
        _cloneInto(to) {
            to || (to = new this.constructor());
            to.set(...this.get());
            const { blockLen, buffer, length, finished, destroyed, pos } = this;
            to.length = length;
            to.pos = pos;
            to.finished = finished;
            to.destroyed = destroyed;
            if (length % blockLen)
                to.buffer.set(buffer);
            return to;
        }
    };

    // Choice: a ? b : c
    const Chi$2 = (a, b, c) => (a & b) ^ (~a & c);
    // Majority function, true if any two inpust is true
    const Maj$2 = (a, b, c) => (a & b) ^ (a & c) ^ (b & c);
    // Round constants:
    // first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311)
    // prettier-ignore
    const SHA256_K$2 = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    // Initial state (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
    // prettier-ignore
    const IV$2 = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    // Temporary buffer, not used to store anything between runs
    // Named this way because it matches specification.
    const SHA256_W$2 = new Uint32Array(64);
    let SHA256$2 = class SHA256 extends SHA2$2 {
        constructor() {
            super(64, 32, 8, false);
            // We cannot use array here since array allows indexing by variable
            // which means optimizer/compiler cannot use registers.
            this.A = IV$2[0] | 0;
            this.B = IV$2[1] | 0;
            this.C = IV$2[2] | 0;
            this.D = IV$2[3] | 0;
            this.E = IV$2[4] | 0;
            this.F = IV$2[5] | 0;
            this.G = IV$2[6] | 0;
            this.H = IV$2[7] | 0;
        }
        get() {
            const { A, B, C, D, E, F, G, H } = this;
            return [A, B, C, D, E, F, G, H];
        }
        // prettier-ignore
        set(A, B, C, D, E, F, G, H) {
            this.A = A | 0;
            this.B = B | 0;
            this.C = C | 0;
            this.D = D | 0;
            this.E = E | 0;
            this.F = F | 0;
            this.G = G | 0;
            this.H = H | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4)
                SHA256_W$2[i] = view.getUint32(offset, false);
            for (let i = 16; i < 64; i++) {
                const W15 = SHA256_W$2[i - 15];
                const W2 = SHA256_W$2[i - 2];
                const s0 = rotr$2(W15, 7) ^ rotr$2(W15, 18) ^ (W15 >>> 3);
                const s1 = rotr$2(W2, 17) ^ rotr$2(W2, 19) ^ (W2 >>> 10);
                SHA256_W$2[i] = (s1 + SHA256_W$2[i - 7] + s0 + SHA256_W$2[i - 16]) | 0;
            }
            // Compression function main loop, 64 rounds
            let { A, B, C, D, E, F, G, H } = this;
            for (let i = 0; i < 64; i++) {
                const sigma1 = rotr$2(E, 6) ^ rotr$2(E, 11) ^ rotr$2(E, 25);
                const T1 = (H + sigma1 + Chi$2(E, F, G) + SHA256_K$2[i] + SHA256_W$2[i]) | 0;
                const sigma0 = rotr$2(A, 2) ^ rotr$2(A, 13) ^ rotr$2(A, 22);
                const T2 = (sigma0 + Maj$2(A, B, C)) | 0;
                H = G;
                G = F;
                F = E;
                E = (D + T1) | 0;
                D = C;
                C = B;
                B = A;
                A = (T1 + T2) | 0;
            }
            // Add the compressed chunk to the current hash value
            A = (A + this.A) | 0;
            B = (B + this.B) | 0;
            C = (C + this.C) | 0;
            D = (D + this.D) | 0;
            E = (E + this.E) | 0;
            F = (F + this.F) | 0;
            G = (G + this.G) | 0;
            H = (H + this.H) | 0;
            this.set(A, B, C, D, E, F, G, H);
        }
        roundClean() {
            SHA256_W$2.fill(0);
        }
        destroy() {
            this.set(0, 0, 0, 0, 0, 0, 0, 0);
            this.buffer.fill(0);
        }
    };
    // Constants from https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf
    let SHA224$1 = class SHA224 extends SHA256$2 {
        constructor() {
            super();
            this.A = 0xc1059ed8 | 0;
            this.B = 0x367cd507 | 0;
            this.C = 0x3070dd17 | 0;
            this.D = 0xf70e5939 | 0;
            this.E = 0xffc00b31 | 0;
            this.F = 0x68581511 | 0;
            this.G = 0x64f98fa7 | 0;
            this.H = 0xbefa4fa4 | 0;
            this.outputLen = 28;
        }
    };
    /**
     * SHA2-256 hash function
     * @param message - data that would be hashed
     */
    const sha256$2 = wrapConstructor$2(() => new SHA256$2());
    wrapConstructor$2(() => new SHA224$1());

    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // 100 lines of code in the file are duplicated from noble-hashes (utils).
    // This is OK: `abstract` directory does not use noble-hashes.
    // User may opt-in into using different hashing library. This way, noble-hashes
    // won't be included into their bundle.
    const _0n$4 = BigInt(0);
    const _1n$4 = BigInt(1);
    const _2n$2 = BigInt(2);
    const u8a$2 = (a) => a instanceof Uint8Array;
    const hexes$2 = Array.from({ length: 256 }, (v, i) => i.toString(16).padStart(2, '0'));
    /**
     * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
     */
    function bytesToHex$2(bytes) {
        if (!u8a$2(bytes))
            throw new Error('Uint8Array expected');
        // pre-caching improves the speed 6x
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += hexes$2[bytes[i]];
        }
        return hex;
    }
    function numberToHexUnpadded(num) {
        const hex = num.toString(16);
        return hex.length & 1 ? `0${hex}` : hex;
    }
    function hexToNumber(hex) {
        if (typeof hex !== 'string')
            throw new Error('hex string expected, got ' + typeof hex);
        // Big Endian
        return BigInt(hex === '' ? '0' : `0x${hex}`);
    }
    /**
     * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
     */
    function hexToBytes$2(hex) {
        if (typeof hex !== 'string')
            throw new Error('hex string expected, got ' + typeof hex);
        const len = hex.length;
        if (len % 2)
            throw new Error('padded hex string expected, got unpadded hex of length ' + len);
        const array = new Uint8Array(len / 2);
        for (let i = 0; i < array.length; i++) {
            const j = i * 2;
            const hexByte = hex.slice(j, j + 2);
            const byte = Number.parseInt(hexByte, 16);
            if (Number.isNaN(byte) || byte < 0)
                throw new Error('Invalid byte sequence');
            array[i] = byte;
        }
        return array;
    }
    // BE: Big Endian, LE: Little Endian
    function bytesToNumberBE(bytes) {
        return hexToNumber(bytesToHex$2(bytes));
    }
    function bytesToNumberLE(bytes) {
        if (!u8a$2(bytes))
            throw new Error('Uint8Array expected');
        return hexToNumber(bytesToHex$2(Uint8Array.from(bytes).reverse()));
    }
    function numberToBytesBE(n, len) {
        return hexToBytes$2(n.toString(16).padStart(len * 2, '0'));
    }
    function numberToBytesLE(n, len) {
        return numberToBytesBE(n, len).reverse();
    }
    // Unpadded, rarely used
    function numberToVarBytesBE(n) {
        return hexToBytes$2(numberToHexUnpadded(n));
    }
    /**
     * Takes hex string or Uint8Array, converts to Uint8Array.
     * Validates output length.
     * Will throw error for other types.
     * @param title descriptive title for an error e.g. 'private key'
     * @param hex hex string or Uint8Array
     * @param expectedLength optional, will compare to result array's length
     * @returns
     */
    function ensureBytes$1(title, hex, expectedLength) {
        let res;
        if (typeof hex === 'string') {
            try {
                res = hexToBytes$2(hex);
            }
            catch (e) {
                throw new Error(`${title} must be valid hex string, got "${hex}". Cause: ${e}`);
            }
        }
        else if (u8a$2(hex)) {
            // Uint8Array.from() instead of hash.slice() because node.js Buffer
            // is instance of Uint8Array, and its slice() creates **mutable** copy
            res = Uint8Array.from(hex);
        }
        else {
            throw new Error(`${title} must be hex string or Uint8Array`);
        }
        const len = res.length;
        if (typeof expectedLength === 'number' && len !== expectedLength)
            throw new Error(`${title} expected ${expectedLength} bytes, got ${len}`);
        return res;
    }
    /**
     * Copies several Uint8Arrays into one.
     */
    function concatBytes$2(...arrays) {
        const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
        let pad = 0; // walk through each item, ensure they have proper type
        arrays.forEach((a) => {
            if (!u8a$2(a))
                throw new Error('Uint8Array expected');
            r.set(a, pad);
            pad += a.length;
        });
        return r;
    }
    function equalBytes$1(b1, b2) {
        // We don't care about timing attacks here
        if (b1.length !== b2.length)
            return false;
        for (let i = 0; i < b1.length; i++)
            if (b1[i] !== b2[i])
                return false;
        return true;
    }
    /**
     * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
     */
    function utf8ToBytes$3(str) {
        if (typeof str !== 'string')
            throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
        return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
    }
    // Bit operations
    /**
     * Calculates amount of bits in a bigint.
     * Same as `n.toString(2).length`
     */
    function bitLen(n) {
        let len;
        for (len = 0; n > _0n$4; n >>= _1n$4, len += 1)
            ;
        return len;
    }
    /**
     * Gets single bit at position.
     * NOTE: first bit position is 0 (same as arrays)
     * Same as `!!+Array.from(n.toString(2)).reverse()[pos]`
     */
    function bitGet(n, pos) {
        return (n >> BigInt(pos)) & _1n$4;
    }
    /**
     * Sets single bit at position.
     */
    const bitSet = (n, pos, value) => {
        return n | ((value ? _1n$4 : _0n$4) << BigInt(pos));
    };
    /**
     * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
     * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
     */
    const bitMask = (n) => (_2n$2 << BigInt(n - 1)) - _1n$4;
    // DRBG
    const u8n = (data) => new Uint8Array(data); // creates Uint8Array
    const u8fr = (arr) => Uint8Array.from(arr); // another shortcut
    /**
     * Minimal HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
     * @returns function that will call DRBG until 2nd arg returns something meaningful
     * @example
     *   const drbg = createHmacDRBG<Key>(32, 32, hmac);
     *   drbg(seed, bytesToKey); // bytesToKey must return Key or undefined
     */
    function createHmacDrbg(hashLen, qByteLen, hmacFn) {
        if (typeof hashLen !== 'number' || hashLen < 2)
            throw new Error('hashLen must be a number');
        if (typeof qByteLen !== 'number' || qByteLen < 2)
            throw new Error('qByteLen must be a number');
        if (typeof hmacFn !== 'function')
            throw new Error('hmacFn must be a function');
        // Step B, Step C: set hashLen to 8*ceil(hlen/8)
        let v = u8n(hashLen); // Minimal non-full-spec HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
        let k = u8n(hashLen); // Steps B and C of RFC6979 3.2: set hashLen, in our case always same
        let i = 0; // Iterations counter, will throw when over 1000
        const reset = () => {
            v.fill(1);
            k.fill(0);
            i = 0;
        };
        const h = (...b) => hmacFn(k, v, ...b); // hmac(k)(v, ...values)
        const reseed = (seed = u8n()) => {
            // HMAC-DRBG reseed() function. Steps D-G
            k = h(u8fr([0x00]), seed); // k = hmac(k || v || 0x00 || seed)
            v = h(); // v = hmac(k || v)
            if (seed.length === 0)
                return;
            k = h(u8fr([0x01]), seed); // k = hmac(k || v || 0x01 || seed)
            v = h(); // v = hmac(k || v)
        };
        const gen = () => {
            // HMAC-DRBG generate() function
            if (i++ >= 1000)
                throw new Error('drbg: tried 1000 values');
            let len = 0;
            const out = [];
            while (len < qByteLen) {
                v = h();
                const sl = v.slice();
                out.push(sl);
                len += v.length;
            }
            return concatBytes$2(...out);
        };
        const genUntil = (seed, pred) => {
            reset();
            reseed(seed); // Steps D-G
            let res = undefined; // Step H: grind until k is in [1..n-1]
            while (!(res = pred(gen())))
                reseed();
            reset();
            return res;
        };
        return genUntil;
    }
    // Validating curves and fields
    const validatorFns = {
        bigint: (val) => typeof val === 'bigint',
        function: (val) => typeof val === 'function',
        boolean: (val) => typeof val === 'boolean',
        string: (val) => typeof val === 'string',
        isSafeInteger: (val) => Number.isSafeInteger(val),
        array: (val) => Array.isArray(val),
        field: (val, object) => object.Fp.isValid(val),
        hash: (val) => typeof val === 'function' && Number.isSafeInteger(val.outputLen),
    };
    // type Record<K extends string | number | symbol, T> = { [P in K]: T; }
    function validateObject(object, validators, optValidators = {}) {
        const checkField = (fieldName, type, isOptional) => {
            const checkVal = validatorFns[type];
            if (typeof checkVal !== 'function')
                throw new Error(`Invalid validator "${type}", expected function`);
            const val = object[fieldName];
            if (isOptional && val === undefined)
                return;
            if (!checkVal(val, object)) {
                throw new Error(`Invalid param ${String(fieldName)}=${val} (${typeof val}), expected ${type}`);
            }
        };
        for (const [fieldName, type] of Object.entries(validators))
            checkField(fieldName, type, false);
        for (const [fieldName, type] of Object.entries(optValidators))
            checkField(fieldName, type, true);
        return object;
    }
    // validate type tests
    // const o: { a: number; b: number; c: number } = { a: 1, b: 5, c: 6 };
    // const z0 = validateObject(o, { a: 'isSafeInteger' }, { c: 'bigint' }); // Ok!
    // // Should fail type-check
    // const z1 = validateObject(o, { a: 'tmp' }, { c: 'zz' });
    // const z2 = validateObject(o, { a: 'isSafeInteger' }, { c: 'zz' });
    // const z3 = validateObject(o, { test: 'boolean', z: 'bug' });
    // const z4 = validateObject(o, { a: 'boolean', z: 'bug' });

    var ut = /*#__PURE__*/Object.freeze({
        __proto__: null,
        bitGet: bitGet,
        bitLen: bitLen,
        bitMask: bitMask,
        bitSet: bitSet,
        bytesToHex: bytesToHex$2,
        bytesToNumberBE: bytesToNumberBE,
        bytesToNumberLE: bytesToNumberLE,
        concatBytes: concatBytes$2,
        createHmacDrbg: createHmacDrbg,
        ensureBytes: ensureBytes$1,
        equalBytes: equalBytes$1,
        hexToBytes: hexToBytes$2,
        hexToNumber: hexToNumber,
        numberToBytesBE: numberToBytesBE,
        numberToBytesLE: numberToBytesLE,
        numberToHexUnpadded: numberToHexUnpadded,
        numberToVarBytesBE: numberToVarBytesBE,
        utf8ToBytes: utf8ToBytes$3,
        validateObject: validateObject
    });

    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // Utilities for modular arithmetics and finite fields
    // prettier-ignore
    const _0n$3 = BigInt(0), _1n$3 = BigInt(1), _2n$1 = BigInt(2), _3n$1 = BigInt(3);
    // prettier-ignore
    const _4n = BigInt(4), _5n = BigInt(5), _8n = BigInt(8);
    // prettier-ignore
    BigInt(9); BigInt(16);
    // Calculates a modulo b
    function mod(a, b) {
        const result = a % b;
        return result >= _0n$3 ? result : b + result;
    }
    /**
     * Efficiently raise num to power and do modular division.
     * Unsafe in some contexts: uses ladder, so can expose bigint bits.
     * @example
     * pow(2n, 6n, 11n) // 64n % 11n == 9n
     */
    // TODO: use field version && remove
    function pow(num, power, modulo) {
        if (modulo <= _0n$3 || power < _0n$3)
            throw new Error('Expected power/modulo > 0');
        if (modulo === _1n$3)
            return _0n$3;
        let res = _1n$3;
        while (power > _0n$3) {
            if (power & _1n$3)
                res = (res * num) % modulo;
            num = (num * num) % modulo;
            power >>= _1n$3;
        }
        return res;
    }
    // Does x ^ (2 ^ power) mod p. pow2(30, 4) == 30 ^ (2 ^ 4)
    function pow2(x, power, modulo) {
        let res = x;
        while (power-- > _0n$3) {
            res *= res;
            res %= modulo;
        }
        return res;
    }
    // Inverses number over modulo
    function invert(number, modulo) {
        if (number === _0n$3 || modulo <= _0n$3) {
            throw new Error(`invert: expected positive integers, got n=${number} mod=${modulo}`);
        }
        // Euclidean GCD https://brilliant.org/wiki/extended-euclidean-algorithm/
        // Fermat's little theorem "CT-like" version inv(n) = n^(m-2) mod m is 30x slower.
        let a = mod(number, modulo);
        let b = modulo;
        // prettier-ignore
        let x = _0n$3, u = _1n$3;
        while (a !== _0n$3) {
            // JIT applies optimization if those two lines follow each other
            const q = b / a;
            const r = b % a;
            const m = x - u * q;
            // prettier-ignore
            b = a, a = r, x = u, u = m;
        }
        const gcd = b;
        if (gcd !== _1n$3)
            throw new Error('invert: does not exist');
        return mod(x, modulo);
    }
    // Tonelli-Shanks algorithm
    // Paper 1: https://eprint.iacr.org/2012/685.pdf (page 12)
    // Paper 2: Square Roots from 1; 24, 51, 10 to Dan Shanks
    function tonelliShanks(P) {
        // Legendre constant: used to calculate Legendre symbol (a | p),
        // which denotes the value of a^((p-1)/2) (mod p).
        // (a | p) ≡ 1    if a is a square (mod p)
        // (a | p) ≡ -1   if a is not a square (mod p)
        // (a | p) ≡ 0    if a ≡ 0 (mod p)
        const legendreC = (P - _1n$3) / _2n$1;
        let Q, S, Z;
        // Step 1: By factoring out powers of 2 from p - 1,
        // find q and s such that p - 1 = q*(2^s) with q odd
        for (Q = P - _1n$3, S = 0; Q % _2n$1 === _0n$3; Q /= _2n$1, S++)
            ;
        // Step 2: Select a non-square z such that (z | p) ≡ -1 and set c ≡ zq
        for (Z = _2n$1; Z < P && pow(Z, legendreC, P) !== P - _1n$3; Z++)
            ;
        // Fast-path
        if (S === 1) {
            const p1div4 = (P + _1n$3) / _4n;
            return function tonelliFast(Fp, n) {
                const root = Fp.pow(n, p1div4);
                if (!Fp.eql(Fp.sqr(root), n))
                    throw new Error('Cannot find square root');
                return root;
            };
        }
        // Slow-path
        const Q1div2 = (Q + _1n$3) / _2n$1;
        return function tonelliSlow(Fp, n) {
            // Step 0: Check that n is indeed a square: (n | p) should not be ≡ -1
            if (Fp.pow(n, legendreC) === Fp.neg(Fp.ONE))
                throw new Error('Cannot find square root');
            let r = S;
            // TODO: will fail at Fp2/etc
            let g = Fp.pow(Fp.mul(Fp.ONE, Z), Q); // will update both x and b
            let x = Fp.pow(n, Q1div2); // first guess at the square root
            let b = Fp.pow(n, Q); // first guess at the fudge factor
            while (!Fp.eql(b, Fp.ONE)) {
                if (Fp.eql(b, Fp.ZERO))
                    return Fp.ZERO; // https://en.wikipedia.org/wiki/Tonelli%E2%80%93Shanks_algorithm (4. If t = 0, return r = 0)
                // Find m such b^(2^m)==1
                let m = 1;
                for (let t2 = Fp.sqr(b); m < r; m++) {
                    if (Fp.eql(t2, Fp.ONE))
                        break;
                    t2 = Fp.sqr(t2); // t2 *= t2
                }
                // NOTE: r-m-1 can be bigger than 32, need to convert to bigint before shift, otherwise there will be overflow
                const ge = Fp.pow(g, _1n$3 << BigInt(r - m - 1)); // ge = 2^(r-m-1)
                g = Fp.sqr(ge); // g = ge * ge
                x = Fp.mul(x, ge); // x *= ge
                b = Fp.mul(b, g); // b *= g
                r = m;
            }
            return x;
        };
    }
    function FpSqrt(P) {
        // NOTE: different algorithms can give different roots, it is up to user to decide which one they want.
        // For example there is FpSqrtOdd/FpSqrtEven to choice root based on oddness (used for hash-to-curve).
        // P ≡ 3 (mod 4)
        // √n = n^((P+1)/4)
        if (P % _4n === _3n$1) {
            // Not all roots possible!
            // const ORDER =
            //   0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaabn;
            // const NUM = 72057594037927816n;
            const p1div4 = (P + _1n$3) / _4n;
            return function sqrt3mod4(Fp, n) {
                const root = Fp.pow(n, p1div4);
                // Throw if root**2 != n
                if (!Fp.eql(Fp.sqr(root), n))
                    throw new Error('Cannot find square root');
                return root;
            };
        }
        // Atkin algorithm for q ≡ 5 (mod 8), https://eprint.iacr.org/2012/685.pdf (page 10)
        if (P % _8n === _5n) {
            const c1 = (P - _5n) / _8n;
            return function sqrt5mod8(Fp, n) {
                const n2 = Fp.mul(n, _2n$1);
                const v = Fp.pow(n2, c1);
                const nv = Fp.mul(n, v);
                const i = Fp.mul(Fp.mul(nv, _2n$1), v);
                const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
                if (!Fp.eql(Fp.sqr(root), n))
                    throw new Error('Cannot find square root');
                return root;
            };
        }
        // Other cases: Tonelli-Shanks algorithm
        return tonelliShanks(P);
    }
    // prettier-ignore
    const FIELD_FIELDS = [
        'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
        'eql', 'add', 'sub', 'mul', 'pow', 'div',
        'addN', 'subN', 'mulN', 'sqrN'
    ];
    function validateField(field) {
        const initial = {
            ORDER: 'bigint',
            MASK: 'bigint',
            BYTES: 'isSafeInteger',
            BITS: 'isSafeInteger',
        };
        const opts = FIELD_FIELDS.reduce((map, val) => {
            map[val] = 'function';
            return map;
        }, initial);
        return validateObject(field, opts);
    }
    // Generic field functions
    function FpPow(f, num, power) {
        // Should have same speed as pow for bigints
        // TODO: benchmark!
        if (power < _0n$3)
            throw new Error('Expected power > 0');
        if (power === _0n$3)
            return f.ONE;
        if (power === _1n$3)
            return num;
        let p = f.ONE;
        let d = num;
        while (power > _0n$3) {
            if (power & _1n$3)
                p = f.mul(p, d);
            d = f.sqr(d);
            power >>= _1n$3;
        }
        return p;
    }
    // 0 is non-invertible: non-batched version will throw on 0
    function FpInvertBatch(f, nums) {
        const tmp = new Array(nums.length);
        // Walk from first to last, multiply them by each other MOD p
        const lastMultiplied = nums.reduce((acc, num, i) => {
            if (f.is0(num))
                return acc;
            tmp[i] = acc;
            return f.mul(acc, num);
        }, f.ONE);
        // Invert last element
        const inverted = f.inv(lastMultiplied);
        // Walk from last to first, multiply them by inverted each other MOD p
        nums.reduceRight((acc, num, i) => {
            if (f.is0(num))
                return acc;
            tmp[i] = f.mul(acc, tmp[i]);
            return f.mul(acc, num);
        }, inverted);
        return tmp;
    }
    // CURVE.n lengths
    function nLength(n, nBitLength) {
        // Bit size, byte size of CURVE.n
        const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
        const nByteLength = Math.ceil(_nBitLength / 8);
        return { nBitLength: _nBitLength, nByteLength };
    }
    /**
     * Initializes a galois field over prime. Non-primes are not supported for now.
     * Do not init in loop: slow. Very fragile: always run a benchmark on change.
     * Major performance gains:
     * a) non-normalized operations like mulN instead of mul
     * b) `Object.freeze`
     * c) Same object shape: never add or remove keys
     * @param ORDER prime positive bigint
     * @param bitLen how many bits the field consumes
     * @param isLE (def: false) if encoding / decoding should be in little-endian
     * @param redef optional faster redefinitions of sqrt and other methods
     */
    function Field(ORDER, bitLen, isLE = false, redef = {}) {
        if (ORDER <= _0n$3)
            throw new Error(`Expected Fp ORDER > 0, got ${ORDER}`);
        const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen);
        if (BYTES > 2048)
            throw new Error('Field lengths over 2048 bytes are not supported');
        const sqrtP = FpSqrt(ORDER);
        const f = Object.freeze({
            ORDER,
            BITS,
            BYTES,
            MASK: bitMask(BITS),
            ZERO: _0n$3,
            ONE: _1n$3,
            create: (num) => mod(num, ORDER),
            isValid: (num) => {
                if (typeof num !== 'bigint')
                    throw new Error(`Invalid field element: expected bigint, got ${typeof num}`);
                return _0n$3 <= num && num < ORDER; // 0 is valid element, but it's not invertible
            },
            is0: (num) => num === _0n$3,
            isOdd: (num) => (num & _1n$3) === _1n$3,
            neg: (num) => mod(-num, ORDER),
            eql: (lhs, rhs) => lhs === rhs,
            sqr: (num) => mod(num * num, ORDER),
            add: (lhs, rhs) => mod(lhs + rhs, ORDER),
            sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
            mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
            pow: (num, power) => FpPow(f, num, power),
            div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
            // Same as above, but doesn't normalize
            sqrN: (num) => num * num,
            addN: (lhs, rhs) => lhs + rhs,
            subN: (lhs, rhs) => lhs - rhs,
            mulN: (lhs, rhs) => lhs * rhs,
            inv: (num) => invert(num, ORDER),
            sqrt: redef.sqrt || ((n) => sqrtP(f, n)),
            invertBatch: (lst) => FpInvertBatch(f, lst),
            // TODO: do we really need constant cmov?
            // We don't have const-time bigints anyway, so probably will be not very useful
            cmov: (a, b, c) => (c ? b : a),
            toBytes: (num) => (isLE ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES)),
            fromBytes: (bytes) => {
                if (bytes.length !== BYTES)
                    throw new Error(`Fp.fromBytes: expected ${BYTES}, got ${bytes.length}`);
                return isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
            },
        });
        return Object.freeze(f);
    }
    /**
     * FIPS 186 B.4.1-compliant "constant-time" private key generation utility.
     * Can take (n+8) or more bytes of uniform input e.g. from CSPRNG or KDF
     * and convert them into private scalar, with the modulo bias being negligible.
     * Needs at least 40 bytes of input for 32-byte private key.
     * https://research.kudelskisecurity.com/2020/07/28/the-definitive-guide-to-modulo-bias-and-how-to-avoid-it/
     * @param hash hash output from SHA3 or a similar function
     * @param groupOrder size of subgroup - (e.g. curveFn.CURVE.n)
     * @param isLE interpret hash bytes as LE num
     * @returns valid private scalar
     */
    function hashToPrivateScalar(hash, groupOrder, isLE = false) {
        hash = ensureBytes$1('privateHash', hash);
        const hashLen = hash.length;
        const minLen = nLength(groupOrder).nByteLength + 8;
        if (minLen < 24 || hashLen < minLen || hashLen > 1024)
            throw new Error(`hashToPrivateScalar: expected ${minLen}-1024 bytes of input, got ${hashLen}`);
        const num = isLE ? bytesToNumberLE(hash) : bytesToNumberBE(hash);
        return mod(num, groupOrder - _1n$3) + _1n$3;
    }

    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // Abelian group utilities
    const _0n$2 = BigInt(0);
    const _1n$2 = BigInt(1);
    // Elliptic curve multiplication of Point by scalar. Fragile.
    // Scalars should always be less than curve order: this should be checked inside of a curve itself.
    // Creates precomputation tables for fast multiplication:
    // - private scalar is split by fixed size windows of W bits
    // - every window point is collected from window's table & added to accumulator
    // - since windows are different, same point inside tables won't be accessed more than once per calc
    // - each multiplication is 'Math.ceil(CURVE_ORDER / 𝑊) + 1' point additions (fixed for any scalar)
    // - +1 window is neccessary for wNAF
    // - wNAF reduces table size: 2x less memory + 2x faster generation, but 10% slower multiplication
    // TODO: Research returning 2d JS array of windows, instead of a single window. This would allow
    // windows to be in different memory locations
    function wNAF(c, bits) {
        const constTimeNegate = (condition, item) => {
            const neg = item.negate();
            return condition ? neg : item;
        };
        const opts = (W) => {
            const windows = Math.ceil(bits / W) + 1; // +1, because
            const windowSize = 2 ** (W - 1); // -1 because we skip zero
            return { windows, windowSize };
        };
        return {
            constTimeNegate,
            // non-const time multiplication ladder
            unsafeLadder(elm, n) {
                let p = c.ZERO;
                let d = elm;
                while (n > _0n$2) {
                    if (n & _1n$2)
                        p = p.add(d);
                    d = d.double();
                    n >>= _1n$2;
                }
                return p;
            },
            /**
             * Creates a wNAF precomputation window. Used for caching.
             * Default window size is set by `utils.precompute()` and is equal to 8.
             * Number of precomputed points depends on the curve size:
             * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
             * - 𝑊 is the window size
             * - 𝑛 is the bitlength of the curve order.
             * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
             * @returns precomputed point tables flattened to a single array
             */
            precomputeWindow(elm, W) {
                const { windows, windowSize } = opts(W);
                const points = [];
                let p = elm;
                let base = p;
                for (let window = 0; window < windows; window++) {
                    base = p;
                    points.push(base);
                    // =1, because we skip zero
                    for (let i = 1; i < windowSize; i++) {
                        base = base.add(p);
                        points.push(base);
                    }
                    p = base.double();
                }
                return points;
            },
            /**
             * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
             * @param W window size
             * @param precomputes precomputed tables
             * @param n scalar (we don't check here, but should be less than curve order)
             * @returns real and fake (for const-time) points
             */
            wNAF(W, precomputes, n) {
                // TODO: maybe check that scalar is less than group order? wNAF behavious is undefined otherwise
                // But need to carefully remove other checks before wNAF. ORDER == bits here
                const { windows, windowSize } = opts(W);
                let p = c.ZERO;
                let f = c.BASE;
                const mask = BigInt(2 ** W - 1); // Create mask with W ones: 0b1111 for W=4 etc.
                const maxNumber = 2 ** W;
                const shiftBy = BigInt(W);
                for (let window = 0; window < windows; window++) {
                    const offset = window * windowSize;
                    // Extract W bits.
                    let wbits = Number(n & mask);
                    // Shift number by W bits.
                    n >>= shiftBy;
                    // If the bits are bigger than max size, we'll split those.
                    // +224 => 256 - 32
                    if (wbits > windowSize) {
                        wbits -= maxNumber;
                        n += _1n$2;
                    }
                    // This code was first written with assumption that 'f' and 'p' will never be infinity point:
                    // since each addition is multiplied by 2 ** W, it cannot cancel each other. However,
                    // there is negate now: it is possible that negated element from low value
                    // would be the same as high element, which will create carry into next window.
                    // It's not obvious how this can fail, but still worth investigating later.
                    // Check if we're onto Zero point.
                    // Add random point inside current window to f.
                    const offset1 = offset;
                    const offset2 = offset + Math.abs(wbits) - 1; // -1 because we skip zero
                    const cond1 = window % 2 !== 0;
                    const cond2 = wbits < 0;
                    if (wbits === 0) {
                        // The most important part for const-time getPublicKey
                        f = f.add(constTimeNegate(cond1, precomputes[offset1]));
                    }
                    else {
                        p = p.add(constTimeNegate(cond2, precomputes[offset2]));
                    }
                }
                // JIT-compiler should not eliminate f here, since it will later be used in normalizeZ()
                // Even if the variable is still unused, there are some checks which will
                // throw an exception, so compiler needs to prove they won't happen, which is hard.
                // At this point there is a way to F be infinity-point even if p is not,
                // which makes it less const-time: around 1 bigint multiply.
                return { p, f };
            },
            wNAFCached(P, precomputesMap, n, transform) {
                // @ts-ignore
                const W = P._WINDOW_SIZE || 1;
                // Calculate precomputes on a first run, reuse them after
                let comp = precomputesMap.get(P);
                if (!comp) {
                    comp = this.precomputeWindow(P, W);
                    if (W !== 1) {
                        precomputesMap.set(P, transform(comp));
                    }
                }
                return this.wNAF(W, comp, n);
            },
        };
    }
    function validateBasic(curve) {
        validateField(curve.Fp);
        validateObject(curve, {
            n: 'bigint',
            h: 'bigint',
            Gx: 'field',
            Gy: 'field',
        }, {
            nBitLength: 'isSafeInteger',
            nByteLength: 'isSafeInteger',
        });
        // Set defaults
        return Object.freeze({
            ...nLength(curve.n, curve.nBitLength),
            ...curve,
            ...{ p: curve.Fp.ORDER },
        });
    }

    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // Short Weierstrass curve. The formula is: y² = x³ + ax + b
    function validatePointOpts(curve) {
        const opts = validateBasic(curve);
        validateObject(opts, {
            a: 'field',
            b: 'field',
        }, {
            allowedPrivateKeyLengths: 'array',
            wrapPrivateKey: 'boolean',
            isTorsionFree: 'function',
            clearCofactor: 'function',
            allowInfinityPoint: 'boolean',
            fromBytes: 'function',
            toBytes: 'function',
        });
        const { endo, Fp, a } = opts;
        if (endo) {
            if (!Fp.eql(a, Fp.ZERO)) {
                throw new Error('Endomorphism can only be defined for Koblitz curves that have a=0');
            }
            if (typeof endo !== 'object' ||
                typeof endo.beta !== 'bigint' ||
                typeof endo.splitScalar !== 'function') {
                throw new Error('Expected endomorphism with beta: bigint and splitScalar: function');
            }
        }
        return Object.freeze({ ...opts });
    }
    // ASN.1 DER encoding utilities
    const { bytesToNumberBE: b2n, hexToBytes: h2b } = ut;
    const DER = {
        // asn.1 DER encoding utils
        Err: class DERErr extends Error {
            constructor(m = '') {
                super(m);
            }
        },
        _parseInt(data) {
            const { Err: E } = DER;
            if (data.length < 2 || data[0] !== 0x02)
                throw new E('Invalid signature integer tag');
            const len = data[1];
            const res = data.subarray(2, len + 2);
            if (!len || res.length !== len)
                throw new E('Invalid signature integer: wrong length');
            // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
            // since we always use positive integers here. It must always be empty:
            // - add zero byte if exists
            // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
            if (res[0] & 0b10000000)
                throw new E('Invalid signature integer: negative');
            if (res[0] === 0x00 && !(res[1] & 0b10000000))
                throw new E('Invalid signature integer: unnecessary leading zero');
            return { d: b2n(res), l: data.subarray(len + 2) }; // d is data, l is left
        },
        toSig(hex) {
            // parse DER signature
            const { Err: E } = DER;
            const data = typeof hex === 'string' ? h2b(hex) : hex;
            if (!(data instanceof Uint8Array))
                throw new Error('ui8a expected');
            let l = data.length;
            if (l < 2 || data[0] != 0x30)
                throw new E('Invalid signature tag');
            if (data[1] !== l - 2)
                throw new E('Invalid signature: incorrect length');
            const { d: r, l: sBytes } = DER._parseInt(data.subarray(2));
            const { d: s, l: rBytesLeft } = DER._parseInt(sBytes);
            if (rBytesLeft.length)
                throw new E('Invalid signature: left bytes after parsing');
            return { r, s };
        },
        hexFromSig(sig) {
            // Add leading zero if first byte has negative bit enabled. More details in '_parseInt'
            const slice = (s) => (Number.parseInt(s[0], 16) & 0b1000 ? '00' + s : s);
            const h = (num) => {
                const hex = num.toString(16);
                return hex.length & 1 ? `0${hex}` : hex;
            };
            const s = slice(h(sig.s));
            const r = slice(h(sig.r));
            const shl = s.length / 2;
            const rhl = r.length / 2;
            const sl = h(shl);
            const rl = h(rhl);
            return `30${h(rhl + shl + 4)}02${rl}${r}02${sl}${s}`;
        },
    };
    // Be friendly to bad ECMAScript parsers by not using bigint literals
    // prettier-ignore
    const _0n$1 = BigInt(0), _1n$1 = BigInt(1); BigInt(2); const _3n = BigInt(3); BigInt(4);
    function weierstrassPoints(opts) {
        const CURVE = validatePointOpts(opts);
        const { Fp } = CURVE; // All curves has same field / group length as for now, but they can differ
        const toBytes = CURVE.toBytes ||
            ((c, point, isCompressed) => {
                const a = point.toAffine();
                return concatBytes$2(Uint8Array.from([0x04]), Fp.toBytes(a.x), Fp.toBytes(a.y));
            });
        const fromBytes = CURVE.fromBytes ||
            ((bytes) => {
                // const head = bytes[0];
                const tail = bytes.subarray(1);
                // if (head !== 0x04) throw new Error('Only non-compressed encoding is supported');
                const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
                const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
                return { x, y };
            });
        /**
         * y² = x³ + ax + b: Short weierstrass curve formula
         * @returns y²
         */
        function weierstrassEquation(x) {
            const { a, b } = CURVE;
            const x2 = Fp.sqr(x); // x * x
            const x3 = Fp.mul(x2, x); // x2 * x
            return Fp.add(Fp.add(x3, Fp.mul(x, a)), b); // x3 + a * x + b
        }
        // Validate whether the passed curve params are valid.
        // We check if curve equation works for generator point.
        // `assertValidity()` won't work: `isTorsionFree()` is not available at this point in bls12-381.
        // ProjectivePoint class has not been initialized yet.
        if (!Fp.eql(Fp.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
            throw new Error('bad generator point: equation left != right');
        // Valid group elements reside in range 1..n-1
        function isWithinCurveOrder(num) {
            return typeof num === 'bigint' && _0n$1 < num && num < CURVE.n;
        }
        function assertGE(num) {
            if (!isWithinCurveOrder(num))
                throw new Error('Expected valid bigint: 0 < bigint < curve.n');
        }
        // Validates if priv key is valid and converts it to bigint.
        // Supports options allowedPrivateKeyLengths and wrapPrivateKey.
        function normPrivateKeyToScalar(key) {
            const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n } = CURVE;
            if (lengths && typeof key !== 'bigint') {
                if (key instanceof Uint8Array)
                    key = bytesToHex$2(key);
                // Normalize to hex string, pad. E.g. P521 would norm 130-132 char hex to 132-char bytes
                if (typeof key !== 'string' || !lengths.includes(key.length))
                    throw new Error('Invalid key');
                key = key.padStart(nByteLength * 2, '0');
            }
            let num;
            try {
                num =
                    typeof key === 'bigint'
                        ? key
                        : bytesToNumberBE(ensureBytes$1('private key', key, nByteLength));
            }
            catch (error) {
                throw new Error(`private key must be ${nByteLength} bytes, hex or bigint, not ${typeof key}`);
            }
            if (wrapPrivateKey)
                num = mod(num, n); // disabled by default, enabled for BLS
            assertGE(num); // num in range [1..N-1]
            return num;
        }
        const pointPrecomputes = new Map();
        function assertPrjPoint(other) {
            if (!(other instanceof Point))
                throw new Error('ProjectivePoint expected');
        }
        /**
         * Projective Point works in 3d / projective (homogeneous) coordinates: (x, y, z) ∋ (x=x/z, y=y/z)
         * Default Point works in 2d / affine coordinates: (x, y)
         * We're doing calculations in projective, because its operations don't require costly inversion.
         */
        class Point {
            constructor(px, py, pz) {
                this.px = px;
                this.py = py;
                this.pz = pz;
                if (px == null || !Fp.isValid(px))
                    throw new Error('x required');
                if (py == null || !Fp.isValid(py))
                    throw new Error('y required');
                if (pz == null || !Fp.isValid(pz))
                    throw new Error('z required');
            }
            // Does not validate if the point is on-curve.
            // Use fromHex instead, or call assertValidity() later.
            static fromAffine(p) {
                const { x, y } = p || {};
                if (!p || !Fp.isValid(x) || !Fp.isValid(y))
                    throw new Error('invalid affine point');
                if (p instanceof Point)
                    throw new Error('projective point not allowed');
                const is0 = (i) => Fp.eql(i, Fp.ZERO);
                // fromAffine(x:0, y:0) would produce (x:0, y:0, z:1), but we need (x:0, y:1, z:0)
                if (is0(x) && is0(y))
                    return Point.ZERO;
                return new Point(x, y, Fp.ONE);
            }
            get x() {
                return this.toAffine().x;
            }
            get y() {
                return this.toAffine().y;
            }
            /**
             * Takes a bunch of Projective Points but executes only one
             * inversion on all of them. Inversion is very slow operation,
             * so this improves performance massively.
             * Optimization: converts a list of projective points to a list of identical points with Z=1.
             */
            static normalizeZ(points) {
                const toInv = Fp.invertBatch(points.map((p) => p.pz));
                return points.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
            }
            /**
             * Converts hash string or Uint8Array to Point.
             * @param hex short/long ECDSA hex
             */
            static fromHex(hex) {
                const P = Point.fromAffine(fromBytes(ensureBytes$1('pointHex', hex)));
                P.assertValidity();
                return P;
            }
            // Multiplies generator point by privateKey.
            static fromPrivateKey(privateKey) {
                return Point.BASE.multiply(normPrivateKeyToScalar(privateKey));
            }
            // "Private method", don't use it directly
            _setWindowSize(windowSize) {
                this._WINDOW_SIZE = windowSize;
                pointPrecomputes.delete(this);
            }
            // A point on curve is valid if it conforms to equation.
            assertValidity() {
                // Zero is valid point too!
                if (this.is0()) {
                    if (CURVE.allowInfinityPoint)
                        return;
                    throw new Error('bad point: ZERO');
                }
                // Some 3rd-party test vectors require different wording between here & `fromCompressedHex`
                const { x, y } = this.toAffine();
                // Check if x, y are valid field elements
                if (!Fp.isValid(x) || !Fp.isValid(y))
                    throw new Error('bad point: x or y not FE');
                const left = Fp.sqr(y); // y²
                const right = weierstrassEquation(x); // x³ + ax + b
                if (!Fp.eql(left, right))
                    throw new Error('bad point: equation left != right');
                if (!this.isTorsionFree())
                    throw new Error('bad point: not in prime-order subgroup');
            }
            hasEvenY() {
                const { y } = this.toAffine();
                if (Fp.isOdd)
                    return !Fp.isOdd(y);
                throw new Error("Field doesn't support isOdd");
            }
            /**
             * Compare one point to another.
             */
            equals(other) {
                assertPrjPoint(other);
                const { px: X1, py: Y1, pz: Z1 } = this;
                const { px: X2, py: Y2, pz: Z2 } = other;
                const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
                const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
                return U1 && U2;
            }
            /**
             * Flips point to one corresponding to (x, -y) in Affine coordinates.
             */
            negate() {
                return new Point(this.px, Fp.neg(this.py), this.pz);
            }
            // Renes-Costello-Batina exception-free doubling formula.
            // There is 30% faster Jacobian formula, but it is not complete.
            // https://eprint.iacr.org/2015/1060, algorithm 3
            // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
            double() {
                const { a, b } = CURVE;
                const b3 = Fp.mul(b, _3n);
                const { px: X1, py: Y1, pz: Z1 } = this;
                let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
                let t0 = Fp.mul(X1, X1); // step 1
                let t1 = Fp.mul(Y1, Y1);
                let t2 = Fp.mul(Z1, Z1);
                let t3 = Fp.mul(X1, Y1);
                t3 = Fp.add(t3, t3); // step 5
                Z3 = Fp.mul(X1, Z1);
                Z3 = Fp.add(Z3, Z3);
                X3 = Fp.mul(a, Z3);
                Y3 = Fp.mul(b3, t2);
                Y3 = Fp.add(X3, Y3); // step 10
                X3 = Fp.sub(t1, Y3);
                Y3 = Fp.add(t1, Y3);
                Y3 = Fp.mul(X3, Y3);
                X3 = Fp.mul(t3, X3);
                Z3 = Fp.mul(b3, Z3); // step 15
                t2 = Fp.mul(a, t2);
                t3 = Fp.sub(t0, t2);
                t3 = Fp.mul(a, t3);
                t3 = Fp.add(t3, Z3);
                Z3 = Fp.add(t0, t0); // step 20
                t0 = Fp.add(Z3, t0);
                t0 = Fp.add(t0, t2);
                t0 = Fp.mul(t0, t3);
                Y3 = Fp.add(Y3, t0);
                t2 = Fp.mul(Y1, Z1); // step 25
                t2 = Fp.add(t2, t2);
                t0 = Fp.mul(t2, t3);
                X3 = Fp.sub(X3, t0);
                Z3 = Fp.mul(t2, t1);
                Z3 = Fp.add(Z3, Z3); // step 30
                Z3 = Fp.add(Z3, Z3);
                return new Point(X3, Y3, Z3);
            }
            // Renes-Costello-Batina exception-free addition formula.
            // There is 30% faster Jacobian formula, but it is not complete.
            // https://eprint.iacr.org/2015/1060, algorithm 1
            // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
            add(other) {
                assertPrjPoint(other);
                const { px: X1, py: Y1, pz: Z1 } = this;
                const { px: X2, py: Y2, pz: Z2 } = other;
                let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
                const a = CURVE.a;
                const b3 = Fp.mul(CURVE.b, _3n);
                let t0 = Fp.mul(X1, X2); // step 1
                let t1 = Fp.mul(Y1, Y2);
                let t2 = Fp.mul(Z1, Z2);
                let t3 = Fp.add(X1, Y1);
                let t4 = Fp.add(X2, Y2); // step 5
                t3 = Fp.mul(t3, t4);
                t4 = Fp.add(t0, t1);
                t3 = Fp.sub(t3, t4);
                t4 = Fp.add(X1, Z1);
                let t5 = Fp.add(X2, Z2); // step 10
                t4 = Fp.mul(t4, t5);
                t5 = Fp.add(t0, t2);
                t4 = Fp.sub(t4, t5);
                t5 = Fp.add(Y1, Z1);
                X3 = Fp.add(Y2, Z2); // step 15
                t5 = Fp.mul(t5, X3);
                X3 = Fp.add(t1, t2);
                t5 = Fp.sub(t5, X3);
                Z3 = Fp.mul(a, t4);
                X3 = Fp.mul(b3, t2); // step 20
                Z3 = Fp.add(X3, Z3);
                X3 = Fp.sub(t1, Z3);
                Z3 = Fp.add(t1, Z3);
                Y3 = Fp.mul(X3, Z3);
                t1 = Fp.add(t0, t0); // step 25
                t1 = Fp.add(t1, t0);
                t2 = Fp.mul(a, t2);
                t4 = Fp.mul(b3, t4);
                t1 = Fp.add(t1, t2);
                t2 = Fp.sub(t0, t2); // step 30
                t2 = Fp.mul(a, t2);
                t4 = Fp.add(t4, t2);
                t0 = Fp.mul(t1, t4);
                Y3 = Fp.add(Y3, t0);
                t0 = Fp.mul(t5, t4); // step 35
                X3 = Fp.mul(t3, X3);
                X3 = Fp.sub(X3, t0);
                t0 = Fp.mul(t3, t1);
                Z3 = Fp.mul(t5, Z3);
                Z3 = Fp.add(Z3, t0); // step 40
                return new Point(X3, Y3, Z3);
            }
            subtract(other) {
                return this.add(other.negate());
            }
            is0() {
                return this.equals(Point.ZERO);
            }
            wNAF(n) {
                return wnaf.wNAFCached(this, pointPrecomputes, n, (comp) => {
                    const toInv = Fp.invertBatch(comp.map((p) => p.pz));
                    return comp.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
                });
            }
            /**
             * Non-constant-time multiplication. Uses double-and-add algorithm.
             * It's faster, but should only be used when you don't care about
             * an exposed private key e.g. sig verification, which works over *public* keys.
             */
            multiplyUnsafe(n) {
                const I = Point.ZERO;
                if (n === _0n$1)
                    return I;
                assertGE(n); // Will throw on 0
                if (n === _1n$1)
                    return this;
                const { endo } = CURVE;
                if (!endo)
                    return wnaf.unsafeLadder(this, n);
                // Apply endomorphism
                let { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
                let k1p = I;
                let k2p = I;
                let d = this;
                while (k1 > _0n$1 || k2 > _0n$1) {
                    if (k1 & _1n$1)
                        k1p = k1p.add(d);
                    if (k2 & _1n$1)
                        k2p = k2p.add(d);
                    d = d.double();
                    k1 >>= _1n$1;
                    k2 >>= _1n$1;
                }
                if (k1neg)
                    k1p = k1p.negate();
                if (k2neg)
                    k2p = k2p.negate();
                k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
                return k1p.add(k2p);
            }
            /**
             * Constant time multiplication.
             * Uses wNAF method. Windowed method may be 10% faster,
             * but takes 2x longer to generate and consumes 2x memory.
             * Uses precomputes when available.
             * Uses endomorphism for Koblitz curves.
             * @param scalar by which the point would be multiplied
             * @returns New point
             */
            multiply(scalar) {
                assertGE(scalar);
                let n = scalar;
                let point, fake; // Fake point is used to const-time mult
                const { endo } = CURVE;
                if (endo) {
                    const { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
                    let { p: k1p, f: f1p } = this.wNAF(k1);
                    let { p: k2p, f: f2p } = this.wNAF(k2);
                    k1p = wnaf.constTimeNegate(k1neg, k1p);
                    k2p = wnaf.constTimeNegate(k2neg, k2p);
                    k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
                    point = k1p.add(k2p);
                    fake = f1p.add(f2p);
                }
                else {
                    const { p, f } = this.wNAF(n);
                    point = p;
                    fake = f;
                }
                // Normalize `z` for both points, but return only real one
                return Point.normalizeZ([point, fake])[0];
            }
            /**
             * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
             * Not using Strauss-Shamir trick: precomputation tables are faster.
             * The trick could be useful if both P and Q are not G (not in our case).
             * @returns non-zero affine point
             */
            multiplyAndAddUnsafe(Q, a, b) {
                const G = Point.BASE; // No Strauss-Shamir trick: we have 10% faster G precomputes
                const mul = (P, a // Select faster multiply() method
                ) => (a === _0n$1 || a === _1n$1 || !P.equals(G) ? P.multiplyUnsafe(a) : P.multiply(a));
                const sum = mul(this, a).add(mul(Q, b));
                return sum.is0() ? undefined : sum;
            }
            // Converts Projective point to affine (x, y) coordinates.
            // Can accept precomputed Z^-1 - for example, from invertBatch.
            // (x, y, z) ∋ (x=x/z, y=y/z)
            toAffine(iz) {
                const { px: x, py: y, pz: z } = this;
                const is0 = this.is0();
                // If invZ was 0, we return zero point. However we still want to execute
                // all operations, so we replace invZ with a random number, 1.
                if (iz == null)
                    iz = is0 ? Fp.ONE : Fp.inv(z);
                const ax = Fp.mul(x, iz);
                const ay = Fp.mul(y, iz);
                const zz = Fp.mul(z, iz);
                if (is0)
                    return { x: Fp.ZERO, y: Fp.ZERO };
                if (!Fp.eql(zz, Fp.ONE))
                    throw new Error('invZ was invalid');
                return { x: ax, y: ay };
            }
            isTorsionFree() {
                const { h: cofactor, isTorsionFree } = CURVE;
                if (cofactor === _1n$1)
                    return true; // No subgroups, always torsion-free
                if (isTorsionFree)
                    return isTorsionFree(Point, this);
                throw new Error('isTorsionFree() has not been declared for the elliptic curve');
            }
            clearCofactor() {
                const { h: cofactor, clearCofactor } = CURVE;
                if (cofactor === _1n$1)
                    return this; // Fast-path
                if (clearCofactor)
                    return clearCofactor(Point, this);
                return this.multiplyUnsafe(CURVE.h);
            }
            toRawBytes(isCompressed = true) {
                this.assertValidity();
                return toBytes(Point, this, isCompressed);
            }
            toHex(isCompressed = true) {
                return bytesToHex$2(this.toRawBytes(isCompressed));
            }
        }
        Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
        Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
        const _bits = CURVE.nBitLength;
        const wnaf = wNAF(Point, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
        // Validate if generator point is on curve
        return {
            CURVE,
            ProjectivePoint: Point,
            normPrivateKeyToScalar,
            weierstrassEquation,
            isWithinCurveOrder,
        };
    }
    function validateOpts(curve) {
        const opts = validateBasic(curve);
        validateObject(opts, {
            hash: 'hash',
            hmac: 'function',
            randomBytes: 'function',
        }, {
            bits2int: 'function',
            bits2int_modN: 'function',
            lowS: 'boolean',
        });
        return Object.freeze({ lowS: true, ...opts });
    }
    function weierstrass(curveDef) {
        const CURVE = validateOpts(curveDef);
        const { Fp, n: CURVE_ORDER } = CURVE;
        const compressedLen = Fp.BYTES + 1; // e.g. 33 for 32
        const uncompressedLen = 2 * Fp.BYTES + 1; // e.g. 65 for 32
        function isValidFieldElement(num) {
            return _0n$1 < num && num < Fp.ORDER; // 0 is banned since it's not invertible FE
        }
        function modN(a) {
            return mod(a, CURVE_ORDER);
        }
        function invN(a) {
            return invert(a, CURVE_ORDER);
        }
        const { ProjectivePoint: Point, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder, } = weierstrassPoints({
            ...CURVE,
            toBytes(c, point, isCompressed) {
                const a = point.toAffine();
                const x = Fp.toBytes(a.x);
                const cat = concatBytes$2;
                if (isCompressed) {
                    return cat(Uint8Array.from([point.hasEvenY() ? 0x02 : 0x03]), x);
                }
                else {
                    return cat(Uint8Array.from([0x04]), x, Fp.toBytes(a.y));
                }
            },
            fromBytes(bytes) {
                const len = bytes.length;
                const head = bytes[0];
                const tail = bytes.subarray(1);
                // this.assertValidity() is done inside of fromHex
                if (len === compressedLen && (head === 0x02 || head === 0x03)) {
                    const x = bytesToNumberBE(tail);
                    if (!isValidFieldElement(x))
                        throw new Error('Point is not on curve');
                    const y2 = weierstrassEquation(x); // y² = x³ + ax + b
                    let y = Fp.sqrt(y2); // y = y² ^ (p+1)/4
                    const isYOdd = (y & _1n$1) === _1n$1;
                    // ECDSA
                    const isHeadOdd = (head & 1) === 1;
                    if (isHeadOdd !== isYOdd)
                        y = Fp.neg(y);
                    return { x, y };
                }
                else if (len === uncompressedLen && head === 0x04) {
                    const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
                    const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
                    return { x, y };
                }
                else {
                    throw new Error(`Point of length ${len} was invalid. Expected ${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes`);
                }
            },
        });
        const numToNByteStr = (num) => bytesToHex$2(numberToBytesBE(num, CURVE.nByteLength));
        function isBiggerThanHalfOrder(number) {
            const HALF = CURVE_ORDER >> _1n$1;
            return number > HALF;
        }
        function normalizeS(s) {
            return isBiggerThanHalfOrder(s) ? modN(-s) : s;
        }
        // slice bytes num
        const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));
        /**
         * ECDSA signature with its (r, s) properties. Supports DER & compact representations.
         */
        class Signature {
            constructor(r, s, recovery) {
                this.r = r;
                this.s = s;
                this.recovery = recovery;
                this.assertValidity();
            }
            // pair (bytes of r, bytes of s)
            static fromCompact(hex) {
                const l = CURVE.nByteLength;
                hex = ensureBytes$1('compactSignature', hex, l * 2);
                return new Signature(slcNum(hex, 0, l), slcNum(hex, l, 2 * l));
            }
            // DER encoded ECDSA signature
            // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
            static fromDER(hex) {
                const { r, s } = DER.toSig(ensureBytes$1('DER', hex));
                return new Signature(r, s);
            }
            assertValidity() {
                // can use assertGE here
                if (!isWithinCurveOrder(this.r))
                    throw new Error('r must be 0 < r < CURVE.n');
                if (!isWithinCurveOrder(this.s))
                    throw new Error('s must be 0 < s < CURVE.n');
            }
            addRecoveryBit(recovery) {
                return new Signature(this.r, this.s, recovery);
            }
            recoverPublicKey(msgHash) {
                const { r, s, recovery: rec } = this;
                const h = bits2int_modN(ensureBytes$1('msgHash', msgHash)); // Truncate hash
                if (rec == null || ![0, 1, 2, 3].includes(rec))
                    throw new Error('recovery id invalid');
                const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
                if (radj >= Fp.ORDER)
                    throw new Error('recovery id 2 or 3 invalid');
                const prefix = (rec & 1) === 0 ? '02' : '03';
                const R = Point.fromHex(prefix + numToNByteStr(radj));
                const ir = invN(radj); // r^-1
                const u1 = modN(-h * ir); // -hr^-1
                const u2 = modN(s * ir); // sr^-1
                const Q = Point.BASE.multiplyAndAddUnsafe(R, u1, u2); // (sr^-1)R-(hr^-1)G = -(hr^-1)G + (sr^-1)
                if (!Q)
                    throw new Error('point at infinify'); // unsafe is fine: no priv data leaked
                Q.assertValidity();
                return Q;
            }
            // Signatures should be low-s, to prevent malleability.
            hasHighS() {
                return isBiggerThanHalfOrder(this.s);
            }
            normalizeS() {
                return this.hasHighS() ? new Signature(this.r, modN(-this.s), this.recovery) : this;
            }
            // DER-encoded
            toDERRawBytes() {
                return hexToBytes$2(this.toDERHex());
            }
            toDERHex() {
                return DER.hexFromSig({ r: this.r, s: this.s });
            }
            // padded bytes of r, then padded bytes of s
            toCompactRawBytes() {
                return hexToBytes$2(this.toCompactHex());
            }
            toCompactHex() {
                return numToNByteStr(this.r) + numToNByteStr(this.s);
            }
        }
        const utils = {
            isValidPrivateKey(privateKey) {
                try {
                    normPrivateKeyToScalar(privateKey);
                    return true;
                }
                catch (error) {
                    return false;
                }
            },
            normPrivateKeyToScalar: normPrivateKeyToScalar,
            /**
             * Produces cryptographically secure private key from random of size (nBitLength+64)
             * as per FIPS 186 B.4.1 with modulo bias being neglible.
             */
            randomPrivateKey: () => {
                const rand = CURVE.randomBytes(Fp.BYTES + 8);
                const num = hashToPrivateScalar(rand, CURVE_ORDER);
                return numberToBytesBE(num, CURVE.nByteLength);
            },
            /**
             * Creates precompute table for an arbitrary EC point. Makes point "cached".
             * Allows to massively speed-up `point.multiply(scalar)`.
             * @returns cached point
             * @example
             * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
             * fast.multiply(privKey); // much faster ECDH now
             */
            precompute(windowSize = 8, point = Point.BASE) {
                point._setWindowSize(windowSize);
                point.multiply(BigInt(3)); // 3 is arbitrary, just need any number here
                return point;
            },
        };
        /**
         * Computes public key for a private key. Checks for validity of the private key.
         * @param privateKey private key
         * @param isCompressed whether to return compact (default), or full key
         * @returns Public key, full when isCompressed=false; short when isCompressed=true
         */
        function getPublicKey(privateKey, isCompressed = true) {
            return Point.fromPrivateKey(privateKey).toRawBytes(isCompressed);
        }
        /**
         * Quick and dirty check for item being public key. Does not validate hex, or being on-curve.
         */
        function isProbPub(item) {
            const arr = item instanceof Uint8Array;
            const str = typeof item === 'string';
            const len = (arr || str) && item.length;
            if (arr)
                return len === compressedLen || len === uncompressedLen;
            if (str)
                return len === 2 * compressedLen || len === 2 * uncompressedLen;
            if (item instanceof Point)
                return true;
            return false;
        }
        /**
         * ECDH (Elliptic Curve Diffie Hellman).
         * Computes shared public key from private key and public key.
         * Checks: 1) private key validity 2) shared key is on-curve.
         * Does NOT hash the result.
         * @param privateA private key
         * @param publicB different public key
         * @param isCompressed whether to return compact (default), or full key
         * @returns shared public key
         */
        function getSharedSecret(privateA, publicB, isCompressed = true) {
            if (isProbPub(privateA))
                throw new Error('first arg must be private key');
            if (!isProbPub(publicB))
                throw new Error('second arg must be public key');
            const b = Point.fromHex(publicB); // check for being on-curve
            return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
        }
        // RFC6979: ensure ECDSA msg is X bytes and < N. RFC suggests optional truncating via bits2octets.
        // FIPS 186-4 4.6 suggests the leftmost min(nBitLen, outLen) bits, which matches bits2int.
        // bits2int can produce res>N, we can do mod(res, N) since the bitLen is the same.
        // int2octets can't be used; pads small msgs with 0: unacceptatble for trunc as per RFC vectors
        const bits2int = CURVE.bits2int ||
            function (bytes) {
                // For curves with nBitLength % 8 !== 0: bits2octets(bits2octets(m)) !== bits2octets(m)
                // for some cases, since bytes.length * 8 is not actual bitLength.
                const num = bytesToNumberBE(bytes); // check for == u8 done here
                const delta = bytes.length * 8 - CURVE.nBitLength; // truncate to nBitLength leftmost bits
                return delta > 0 ? num >> BigInt(delta) : num;
            };
        const bits2int_modN = CURVE.bits2int_modN ||
            function (bytes) {
                return modN(bits2int(bytes)); // can't use bytesToNumberBE here
            };
        // NOTE: pads output with zero as per spec
        const ORDER_MASK = bitMask(CURVE.nBitLength);
        /**
         * Converts to bytes. Checks if num in `[0..ORDER_MASK-1]` e.g.: `[0..2^256-1]`.
         */
        function int2octets(num) {
            if (typeof num !== 'bigint')
                throw new Error('bigint expected');
            if (!(_0n$1 <= num && num < ORDER_MASK))
                throw new Error(`bigint expected < 2^${CURVE.nBitLength}`);
            // works with order, can have different size than numToField!
            return numberToBytesBE(num, CURVE.nByteLength);
        }
        // Steps A, D of RFC6979 3.2
        // Creates RFC6979 seed; converts msg/privKey to numbers.
        // Used only in sign, not in verify.
        // NOTE: we cannot assume here that msgHash has same amount of bytes as curve order, this will be wrong at least for P521.
        // Also it can be bigger for P224 + SHA256
        function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
            if (['recovered', 'canonical'].some((k) => k in opts))
                throw new Error('sign() legacy options not supported');
            const { hash, randomBytes } = CURVE;
            let { lowS, prehash, extraEntropy: ent } = opts; // generates low-s sigs by default
            if (lowS == null)
                lowS = true; // RFC6979 3.2: we skip step A, because we already provide hash
            msgHash = ensureBytes$1('msgHash', msgHash);
            if (prehash)
                msgHash = ensureBytes$1('prehashed msgHash', hash(msgHash));
            // We can't later call bits2octets, since nested bits2int is broken for curves
            // with nBitLength % 8 !== 0. Because of that, we unwrap it here as int2octets call.
            // const bits2octets = (bits) => int2octets(bits2int_modN(bits))
            const h1int = bits2int_modN(msgHash);
            const d = normPrivateKeyToScalar(privateKey); // validate private key, convert to bigint
            const seedArgs = [int2octets(d), int2octets(h1int)];
            // extraEntropy. RFC6979 3.6: additional k' (optional).
            if (ent != null) {
                // K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1) || k')
                const e = ent === true ? randomBytes(Fp.BYTES) : ent; // generate random bytes OR pass as-is
                seedArgs.push(ensureBytes$1('extraEntropy', e, Fp.BYTES)); // check for being of size BYTES
            }
            const seed = concatBytes$2(...seedArgs); // Step D of RFC6979 3.2
            const m = h1int; // NOTE: no need to call bits2int second time here, it is inside truncateHash!
            // Converts signature params into point w r/s, checks result for validity.
            function k2sig(kBytes) {
                // RFC 6979 Section 3.2, step 3: k = bits2int(T)
                const k = bits2int(kBytes); // Cannot use fields methods, since it is group element
                if (!isWithinCurveOrder(k))
                    return; // Important: all mod() calls here must be done over N
                const ik = invN(k); // k^-1 mod n
                const q = Point.BASE.multiply(k).toAffine(); // q = Gk
                const r = modN(q.x); // r = q.x mod n
                if (r === _0n$1)
                    return;
                // Can use scalar blinding b^-1(bm + bdr) where b ∈ [1,q−1] according to
                // https://tches.iacr.org/index.php/TCHES/article/view/7337/6509. We've decided against it:
                // a) dependency on CSPRNG b) 15% slowdown c) doesn't really help since bigints are not CT
                const s = modN(ik * modN(m + r * d)); // Not using blinding here
                if (s === _0n$1)
                    return;
                let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n$1); // recovery bit (2 or 3, when q.x > n)
                let normS = s;
                if (lowS && isBiggerThanHalfOrder(s)) {
                    normS = normalizeS(s); // if lowS was passed, ensure s is always
                    recovery ^= 1; // // in the bottom half of N
                }
                return new Signature(r, normS, recovery); // use normS, not s
            }
            return { seed, k2sig };
        }
        const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
        const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
        /**
         * Signs message hash with a private key.
         * ```
         * sign(m, d, k) where
         *   (x, y) = G × k
         *   r = x mod n
         *   s = (m + dr)/k mod n
         * ```
         * @param msgHash NOT message. msg needs to be hashed to `msgHash`, or use `prehash`.
         * @param privKey private key
         * @param opts lowS for non-malleable sigs. extraEntropy for mixing randomness into k. prehash will hash first arg.
         * @returns signature with recovery param
         */
        function sign(msgHash, privKey, opts = defaultSigOpts) {
            const { seed, k2sig } = prepSig(msgHash, privKey, opts); // Steps A, D of RFC6979 3.2.
            const C = CURVE;
            const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
            return drbg(seed, k2sig); // Steps B, C, D, E, F, G
        }
        // Enable precomputes. Slows down first publicKey computation by 20ms.
        Point.BASE._setWindowSize(8);
        // utils.precompute(8, ProjectivePoint.BASE)
        /**
         * Verifies a signature against message hash and public key.
         * Rejects lowS signatures by default: to override,
         * specify option `{lowS: false}`. Implements section 4.1.4 from https://www.secg.org/sec1-v2.pdf:
         *
         * ```
         * verify(r, s, h, P) where
         *   U1 = hs^-1 mod n
         *   U2 = rs^-1 mod n
         *   R = U1⋅G - U2⋅P
         *   mod(R.x, n) == r
         * ```
         */
        function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
            const sg = signature;
            msgHash = ensureBytes$1('msgHash', msgHash);
            publicKey = ensureBytes$1('publicKey', publicKey);
            if ('strict' in opts)
                throw new Error('options.strict was renamed to lowS');
            const { lowS, prehash } = opts;
            let _sig = undefined;
            let P;
            try {
                if (typeof sg === 'string' || sg instanceof Uint8Array) {
                    // Signature can be represented in 2 ways: compact (2*nByteLength) & DER (variable-length).
                    // Since DER can also be 2*nByteLength bytes, we check for it first.
                    try {
                        _sig = Signature.fromDER(sg);
                    }
                    catch (derError) {
                        if (!(derError instanceof DER.Err))
                            throw derError;
                        _sig = Signature.fromCompact(sg);
                    }
                }
                else if (typeof sg === 'object' && typeof sg.r === 'bigint' && typeof sg.s === 'bigint') {
                    const { r, s } = sg;
                    _sig = new Signature(r, s);
                }
                else {
                    throw new Error('PARSE');
                }
                P = Point.fromHex(publicKey);
            }
            catch (error) {
                if (error.message === 'PARSE')
                    throw new Error(`signature must be Signature instance, Uint8Array or hex string`);
                return false;
            }
            if (lowS && _sig.hasHighS())
                return false;
            if (prehash)
                msgHash = CURVE.hash(msgHash);
            const { r, s } = _sig;
            const h = bits2int_modN(msgHash); // Cannot use fields methods, since it is group element
            const is = invN(s); // s^-1
            const u1 = modN(h * is); // u1 = hs^-1 mod n
            const u2 = modN(r * is); // u2 = rs^-1 mod n
            const R = Point.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine(); // R = u1⋅G + u2⋅P
            if (!R)
                return false;
            const v = modN(R.x);
            return v === r;
        }
        return {
            CURVE,
            getPublicKey,
            getSharedSecret,
            sign,
            verify,
            ProjectivePoint: Point,
            Signature,
            utils,
        };
    }

    // HMAC (RFC 2104)
    let HMAC$2 = class HMAC extends Hash$2 {
        constructor(hash, _key) {
            super();
            this.finished = false;
            this.destroyed = false;
            assert$3.hash(hash);
            const key = toBytes$3(_key);
            this.iHash = hash.create();
            if (typeof this.iHash.update !== 'function')
                throw new Error('Expected instance of class which extends utils.Hash');
            this.blockLen = this.iHash.blockLen;
            this.outputLen = this.iHash.outputLen;
            const blockLen = this.blockLen;
            const pad = new Uint8Array(blockLen);
            // blockLen can be bigger than outputLen
            pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36;
            this.iHash.update(pad);
            // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
            this.oHash = hash.create();
            // Undo internal XOR && apply outer XOR
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36 ^ 0x5c;
            this.oHash.update(pad);
            pad.fill(0);
        }
        update(buf) {
            assert$3.exists(this);
            this.iHash.update(buf);
            return this;
        }
        digestInto(out) {
            assert$3.exists(this);
            assert$3.bytes(out, this.outputLen);
            this.finished = true;
            this.iHash.digestInto(out);
            this.oHash.update(out);
            this.oHash.digestInto(out);
            this.destroy();
        }
        digest() {
            const out = new Uint8Array(this.oHash.outputLen);
            this.digestInto(out);
            return out;
        }
        _cloneInto(to) {
            // Create new instance without calling constructor since key already in state and we don't know it.
            to || (to = Object.create(Object.getPrototypeOf(this), {}));
            const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
            to = to;
            to.finished = finished;
            to.destroyed = destroyed;
            to.blockLen = blockLen;
            to.outputLen = outputLen;
            to.oHash = oHash._cloneInto(to.oHash);
            to.iHash = iHash._cloneInto(to.iHash);
            return to;
        }
        destroy() {
            this.destroyed = true;
            this.oHash.destroy();
            this.iHash.destroy();
        }
    };
    /**
     * HMAC: RFC2104 message authentication code.
     * @param hash - function that would be used e.g. sha256
     * @param key - message key
     * @param message - message data
     */
    const hmac$2 = (hash, key, message) => new HMAC$2(hash, key).update(message).digest();
    hmac$2.create = (hash, key) => new HMAC$2(hash, key);

    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // connects noble-curves to noble-hashes
    function getHash(hash) {
        return {
            hash,
            hmac: (key, ...msgs) => hmac$2(hash, key, concatBytes$3(...msgs)),
            randomBytes: randomBytes$2,
        };
    }
    function createCurve(curveDef, defHash) {
        const create = (hash) => weierstrass({ ...curveDef, ...getHash(hash) });
        return Object.freeze({ ...create(defHash), create });
    }

    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    const secp256k1P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f');
    const secp256k1N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
    const _1n = BigInt(1);
    const _2n = BigInt(2);
    const divNearest = (a, b) => (a + b / _2n) / b;
    /**
     * √n = n^((p+1)/4) for fields p = 3 mod 4. We unwrap the loop and multiply bit-by-bit.
     * (P+1n/4n).toString(2) would produce bits [223x 1, 0, 22x 1, 4x 0, 11, 00]
     */
    function sqrtMod(y) {
        const P = secp256k1P;
        // prettier-ignore
        const _3n = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
        // prettier-ignore
        const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
        const b2 = (y * y * y) % P; // x^3, 11
        const b3 = (b2 * b2 * y) % P; // x^7
        const b6 = (pow2(b3, _3n, P) * b3) % P;
        const b9 = (pow2(b6, _3n, P) * b3) % P;
        const b11 = (pow2(b9, _2n, P) * b2) % P;
        const b22 = (pow2(b11, _11n, P) * b11) % P;
        const b44 = (pow2(b22, _22n, P) * b22) % P;
        const b88 = (pow2(b44, _44n, P) * b44) % P;
        const b176 = (pow2(b88, _88n, P) * b88) % P;
        const b220 = (pow2(b176, _44n, P) * b44) % P;
        const b223 = (pow2(b220, _3n, P) * b3) % P;
        const t1 = (pow2(b223, _23n, P) * b22) % P;
        const t2 = (pow2(t1, _6n, P) * b2) % P;
        const root = pow2(t2, _2n, P);
        if (!Fp.eql(Fp.sqr(root), y))
            throw new Error('Cannot find square root');
        return root;
    }
    const Fp = Field(secp256k1P, undefined, undefined, { sqrt: sqrtMod });
    const secp256k1 = createCurve({
        a: BigInt(0),
        b: BigInt(7),
        Fp,
        n: secp256k1N,
        // Base point (x, y) aka generator point
        Gx: BigInt('55066263022277343669578718895168534326250603453777594175500187360389116729240'),
        Gy: BigInt('32670510020758816978083085130507043184471273380659243275938904335757337482424'),
        h: BigInt(1),
        lowS: true,
        /**
         * secp256k1 belongs to Koblitz curves: it has efficiently computable endomorphism.
         * Endomorphism uses 2x less RAM, speeds up precomputation by 2x and ECDH / key recovery by 20%.
         * For precomputed wNAF it trades off 1/2 init time & 1/3 ram for 20% perf hit.
         * Explanation: https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066
         */
        endo: {
            beta: BigInt('0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee'),
            splitScalar: (k) => {
                const n = secp256k1N;
                const a1 = BigInt('0x3086d221a7d46bcde86c90e49284eb15');
                const b1 = -_1n * BigInt('0xe4437ed6010e88286f547fa90abfe4c3');
                const a2 = BigInt('0x114ca50f7a8e2f3f657c1108d9d44cfd8');
                const b2 = a1;
                const POW_2_128 = BigInt('0x100000000000000000000000000000000'); // (2n**128n).toString(16)
                const c1 = divNearest(b2 * k, n);
                const c2 = divNearest(-b1 * k, n);
                let k1 = mod(k - c1 * a1 - c2 * a2, n);
                let k2 = mod(-c1 * b1 - c2 * b2, n);
                const k1neg = k1 > POW_2_128;
                const k2neg = k2 > POW_2_128;
                if (k1neg)
                    k1 = n - k1;
                if (k2neg)
                    k2 = n - k2;
                if (k1 > POW_2_128 || k2 > POW_2_128) {
                    throw new Error('splitScalar: Endomorphism failed, k=' + k);
                }
                return { k1neg, k1, k2neg, k2 };
            },
        },
    }, sha256$2);
    // Schnorr signatures are superior to ECDSA from above. Below is Schnorr-specific BIP0340 code.
    // https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
    const _0n = BigInt(0);
    const fe = (x) => typeof x === 'bigint' && _0n < x && x < secp256k1P;
    const ge = (x) => typeof x === 'bigint' && _0n < x && x < secp256k1N;
    /** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
    const TAGGED_HASH_PREFIXES = {};
    function taggedHash(tag, ...messages) {
        let tagP = TAGGED_HASH_PREFIXES[tag];
        if (tagP === undefined) {
            const tagH = sha256$2(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
            tagP = concatBytes$2(tagH, tagH);
            TAGGED_HASH_PREFIXES[tag] = tagP;
        }
        return sha256$2(concatBytes$2(tagP, ...messages));
    }
    // ECDSA compact points are 33-byte. Schnorr is 32: we strip first byte 0x02 or 0x03
    const pointToBytes = (point) => point.toRawBytes(true).slice(1);
    const numTo32b = (n) => numberToBytesBE(n, 32);
    const modP = (x) => mod(x, secp256k1P);
    const modN = (x) => mod(x, secp256k1N);
    const Point$1 = secp256k1.ProjectivePoint;
    const GmulAdd = (Q, a, b) => Point$1.BASE.multiplyAndAddUnsafe(Q, a, b);
    // Calculate point, scalar and bytes
    function schnorrGetExtPubKey(priv) {
        let d_ = secp256k1.utils.normPrivateKeyToScalar(priv); // same method executed in fromPrivateKey
        let p = Point$1.fromPrivateKey(d_); // P = d'⋅G; 0 < d' < n check is done inside
        const scalar = p.hasEvenY() ? d_ : modN(-d_);
        return { scalar: scalar, bytes: pointToBytes(p) };
    }
    /**
     * lift_x from BIP340. Convert 32-byte x coordinate to elliptic curve point.
     * @returns valid point checked for being on-curve
     */
    function lift_x(x) {
        if (!fe(x))
            throw new Error('bad x: need 0 < x < p'); // Fail if x ≥ p.
        const xx = modP(x * x);
        const c = modP(xx * x + BigInt(7)); // Let c = x³ + 7 mod p.
        let y = sqrtMod(c); // Let y = c^(p+1)/4 mod p.
        if (y % _2n !== _0n)
            y = modP(-y); // Return the unique point P such that x(P) = x and
        const p = new Point$1(x, y, _1n); // y(P) = y if y mod 2 = 0 or y(P) = p-y otherwise.
        p.assertValidity();
        return p;
    }
    /**
     * Create tagged hash, convert it to bigint, reduce modulo-n.
     */
    function challenge(...args) {
        return modN(bytesToNumberBE(taggedHash('BIP0340/challenge', ...args)));
    }
    /**
     * Schnorr public key is just `x` coordinate of Point as per BIP340.
     */
    function schnorrGetPublicKey(privateKey) {
        return schnorrGetExtPubKey(privateKey).bytes; // d'=int(sk). Fail if d'=0 or d'≥n. Ret bytes(d'⋅G)
    }
    /**
     * Creates Schnorr signature as per BIP340. Verifies itself before returning anything.
     * auxRand is optional and is not the sole source of k generation: bad CSPRNG won't be dangerous.
     */
    function schnorrSign(message, privateKey, auxRand = randomBytes$2(32)) {
        const m = ensureBytes$1('message', message);
        const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey); // checks for isWithinCurveOrder
        const a = ensureBytes$1('auxRand', auxRand, 32); // Auxiliary random data a: a 32-byte array
        const t = numTo32b(d ^ bytesToNumberBE(taggedHash('BIP0340/aux', a))); // Let t be the byte-wise xor of bytes(d) and hash/aux(a)
        const rand = taggedHash('BIP0340/nonce', t, px, m); // Let rand = hash/nonce(t || bytes(P) || m)
        const k_ = modN(bytesToNumberBE(rand)); // Let k' = int(rand) mod n
        if (k_ === _0n)
            throw new Error('sign failed: k is zero'); // Fail if k' = 0.
        const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_); // Let R = k'⋅G.
        const e = challenge(rx, px, m); // Let e = int(hash/challenge(bytes(R) || bytes(P) || m)) mod n.
        const sig = new Uint8Array(64); // Let sig = bytes(R) || bytes((k + ed) mod n).
        sig.set(rx, 0);
        sig.set(numTo32b(modN(k + e * d)), 32);
        // If Verify(bytes(P), m, sig) (see below) returns failure, abort
        if (!schnorrVerify(sig, m, px))
            throw new Error('sign: Invalid signature produced');
        return sig;
    }
    /**
     * Verifies Schnorr signature.
     * Will swallow errors & return false except for initial type validation of arguments.
     */
    function schnorrVerify(signature, message, publicKey) {
        const sig = ensureBytes$1('signature', signature, 64);
        const m = ensureBytes$1('message', message);
        const pub = ensureBytes$1('publicKey', publicKey, 32);
        try {
            const P = lift_x(bytesToNumberBE(pub)); // P = lift_x(int(pk)); fail if that fails
            const r = bytesToNumberBE(sig.subarray(0, 32)); // Let r = int(sig[0:32]); fail if r ≥ p.
            if (!fe(r))
                return false;
            const s = bytesToNumberBE(sig.subarray(32, 64)); // Let s = int(sig[32:64]); fail if s ≥ n.
            if (!ge(s))
                return false;
            const e = challenge(numTo32b(r), pointToBytes(P), m); // int(challenge(bytes(r)||bytes(P)||m))%n
            const R = GmulAdd(P, s, modN(-e)); // R = s⋅G - e⋅P
            if (!R || !R.hasEvenY() || R.toAffine().x !== r)
                return false; // -eP == (n-e)P
            return true; // Fail if is_infinite(R) / not has_even_y(R) / x(R) ≠ r.
        }
        catch (error) {
            return false;
        }
    }
    const schnorr = /* @__PURE__ */ (() => ({
        getPublicKey: schnorrGetPublicKey,
        sign: schnorrSign,
        verify: schnorrVerify,
        utils: {
            randomPrivateKey: secp256k1.utils.randomPrivateKey,
            lift_x,
            pointToBytes,
            numberToBytesBE,
            bytesToNumberBE,
            taggedHash,
            mod,
        },
    }))();

    const crypto$2 = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
    // node.js versions earlier than v19 don't declare it in global scope.
    // For node.js, package.json#exports field mapping rewrites import
    // from `crypto` to `cryptoNode`, which imports native module.
    // Makes the utils un-importable in browsers without a bundler.
    // Once node.js 18 is deprecated, we can just drop the import.
    const u8a$1 = (a) => a instanceof Uint8Array;
    // Cast array to view
    const createView$1 = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    // The rotate right (circular right shift) operation for uint32
    const rotr$1 = (word, shift) => (word << (32 - shift)) | (word >>> shift);
    // big-endian hardware is rare. Just in case someone still decides to run hashes:
    // early-throw an error because we don't support BE yet.
    const isLE$2 = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
    if (!isLE$2)
        throw new Error('Non little-endian hardware is not supported');
    const hexes$1 = Array.from({ length: 256 }, (v, i) => i.toString(16).padStart(2, '0'));
    /**
     * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
     */
    function bytesToHex$1(bytes) {
        if (!u8a$1(bytes))
            throw new Error('Uint8Array expected');
        // pre-caching improves the speed 6x
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += hexes$1[bytes[i]];
        }
        return hex;
    }
    /**
     * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
     */
    function hexToBytes$1(hex) {
        if (typeof hex !== 'string')
            throw new Error('hex string expected, got ' + typeof hex);
        const len = hex.length;
        if (len % 2)
            throw new Error('padded hex string expected, got unpadded hex of length ' + len);
        const array = new Uint8Array(len / 2);
        for (let i = 0; i < array.length; i++) {
            const j = i * 2;
            const hexByte = hex.slice(j, j + 2);
            const byte = Number.parseInt(hexByte, 16);
            if (Number.isNaN(byte) || byte < 0)
                throw new Error('Invalid byte sequence');
            array[i] = byte;
        }
        return array;
    }
    /**
     * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
     */
    function utf8ToBytes$2(str) {
        if (typeof str !== 'string')
            throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
        return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
    }
    /**
     * Normalizes (non-hex) string or Uint8Array to Uint8Array.
     * Warning: when Uint8Array is passed, it would NOT get copied.
     * Keep in mind for future mutable operations.
     */
    function toBytes$2(data) {
        if (typeof data === 'string')
            data = utf8ToBytes$2(data);
        if (!u8a$1(data))
            throw new Error(`expected Uint8Array, got ${typeof data}`);
        return data;
    }
    /**
     * Copies several Uint8Arrays into one.
     */
    function concatBytes$1(...arrays) {
        const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
        let pad = 0; // walk through each item, ensure they have proper type
        arrays.forEach((a) => {
            if (!u8a$1(a))
                throw new Error('Uint8Array expected');
            r.set(a, pad);
            pad += a.length;
        });
        return r;
    }
    // For runtime check if class implements interface
    let Hash$1 = class Hash {
        // Safe version that clones internal state
        clone() {
            return this._cloneInto();
        }
    };
    function wrapConstructor$1(hashCons) {
        const hashC = (msg) => hashCons().update(toBytes$2(msg)).digest();
        const tmp = hashCons();
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = () => hashCons();
        return hashC;
    }
    /**
     * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
     */
    function randomBytes$1(bytesLength = 32) {
        if (crypto$2 && typeof crypto$2.getRandomValues === 'function') {
            return crypto$2.getRandomValues(new Uint8Array(bytesLength));
        }
        throw new Error('crypto.getRandomValues must be defined');
    }

    function number$2(n) {
        if (!Number.isSafeInteger(n) || n < 0)
            throw new Error(`Wrong positive integer: ${n}`);
    }
    function bool$2(b) {
        if (typeof b !== 'boolean')
            throw new Error(`Expected boolean, not ${b}`);
    }
    function bytes$2(b, ...lengths) {
        if (!(b instanceof Uint8Array))
            throw new Error('Expected Uint8Array');
        if (lengths.length > 0 && !lengths.includes(b.length))
            throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
    }
    function hash$2(hash) {
        if (typeof hash !== 'function' || typeof hash.create !== 'function')
            throw new Error('Hash should be wrapped by utils.wrapConstructor');
        number$2(hash.outputLen);
        number$2(hash.blockLen);
    }
    function exists$2(instance, checkFinished = true) {
        if (instance.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (checkFinished && instance.finished)
            throw new Error('Hash#digest() has already been called');
    }
    function output$2(out, instance) {
        bytes$2(out);
        const min = instance.outputLen;
        if (out.length < min) {
            throw new Error(`digestInto() expects output buffer of length at least ${min}`);
        }
    }
    const assert$2 = {
        number: number$2,
        bool: bool$2,
        bytes: bytes$2,
        hash: hash$2,
        exists: exists$2,
        output: output$2,
    };

    // Polyfill for Safari 14
    function setBigUint64$1(view, byteOffset, value, isLE) {
        if (typeof view.setBigUint64 === 'function')
            return view.setBigUint64(byteOffset, value, isLE);
        const _32n = BigInt(32);
        const _u32_max = BigInt(0xffffffff);
        const wh = Number((value >> _32n) & _u32_max);
        const wl = Number(value & _u32_max);
        const h = isLE ? 4 : 0;
        const l = isLE ? 0 : 4;
        view.setUint32(byteOffset + h, wh, isLE);
        view.setUint32(byteOffset + l, wl, isLE);
    }
    // Base SHA2 class (RFC 6234)
    let SHA2$1 = class SHA2 extends Hash$1 {
        constructor(blockLen, outputLen, padOffset, isLE) {
            super();
            this.blockLen = blockLen;
            this.outputLen = outputLen;
            this.padOffset = padOffset;
            this.isLE = isLE;
            this.finished = false;
            this.length = 0;
            this.pos = 0;
            this.destroyed = false;
            this.buffer = new Uint8Array(blockLen);
            this.view = createView$1(this.buffer);
        }
        update(data) {
            assert$2.exists(this);
            const { view, buffer, blockLen } = this;
            data = toBytes$2(data);
            const len = data.length;
            for (let pos = 0; pos < len;) {
                const take = Math.min(blockLen - this.pos, len - pos);
                // Fast path: we have at least one block in input, cast it to view and process
                if (take === blockLen) {
                    const dataView = createView$1(data);
                    for (; blockLen <= len - pos; pos += blockLen)
                        this.process(dataView, pos);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                pos += take;
                if (this.pos === blockLen) {
                    this.process(view, 0);
                    this.pos = 0;
                }
            }
            this.length += data.length;
            this.roundClean();
            return this;
        }
        digestInto(out) {
            assert$2.exists(this);
            assert$2.output(out, this);
            this.finished = true;
            // Padding
            // We can avoid allocation of buffer for padding completely if it
            // was previously not allocated here. But it won't change performance.
            const { buffer, view, blockLen, isLE } = this;
            let { pos } = this;
            // append the bit '1' to the message
            buffer[pos++] = 0b10000000;
            this.buffer.subarray(pos).fill(0);
            // we have less than padOffset left in buffer, so we cannot put length in current block, need process it and pad again
            if (this.padOffset > blockLen - pos) {
                this.process(view, 0);
                pos = 0;
            }
            // Pad until full block byte with zeros
            for (let i = pos; i < blockLen; i++)
                buffer[i] = 0;
            // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
            // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
            // So we just write lowest 64 bits of that value.
            setBigUint64$1(view, blockLen - 8, BigInt(this.length * 8), isLE);
            this.process(view, 0);
            const oview = createView$1(out);
            const len = this.outputLen;
            // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
            if (len % 4)
                throw new Error('_sha2: outputLen should be aligned to 32bit');
            const outLen = len / 4;
            const state = this.get();
            if (outLen > state.length)
                throw new Error('_sha2: outputLen bigger than state');
            for (let i = 0; i < outLen; i++)
                oview.setUint32(4 * i, state[i], isLE);
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
        _cloneInto(to) {
            to || (to = new this.constructor());
            to.set(...this.get());
            const { blockLen, buffer, length, finished, destroyed, pos } = this;
            to.length = length;
            to.pos = pos;
            to.finished = finished;
            to.destroyed = destroyed;
            if (length % blockLen)
                to.buffer.set(buffer);
            return to;
        }
    };

    // Choice: a ? b : c
    const Chi$1 = (a, b, c) => (a & b) ^ (~a & c);
    // Majority function, true if any two inpust is true
    const Maj$1 = (a, b, c) => (a & b) ^ (a & c) ^ (b & c);
    // Round constants:
    // first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311)
    // prettier-ignore
    const SHA256_K$1 = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    // Initial state (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
    // prettier-ignore
    const IV$1 = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    // Temporary buffer, not used to store anything between runs
    // Named this way because it matches specification.
    const SHA256_W$1 = new Uint32Array(64);
    let SHA256$1 = class SHA256 extends SHA2$1 {
        constructor() {
            super(64, 32, 8, false);
            // We cannot use array here since array allows indexing by variable
            // which means optimizer/compiler cannot use registers.
            this.A = IV$1[0] | 0;
            this.B = IV$1[1] | 0;
            this.C = IV$1[2] | 0;
            this.D = IV$1[3] | 0;
            this.E = IV$1[4] | 0;
            this.F = IV$1[5] | 0;
            this.G = IV$1[6] | 0;
            this.H = IV$1[7] | 0;
        }
        get() {
            const { A, B, C, D, E, F, G, H } = this;
            return [A, B, C, D, E, F, G, H];
        }
        // prettier-ignore
        set(A, B, C, D, E, F, G, H) {
            this.A = A | 0;
            this.B = B | 0;
            this.C = C | 0;
            this.D = D | 0;
            this.E = E | 0;
            this.F = F | 0;
            this.G = G | 0;
            this.H = H | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4)
                SHA256_W$1[i] = view.getUint32(offset, false);
            for (let i = 16; i < 64; i++) {
                const W15 = SHA256_W$1[i - 15];
                const W2 = SHA256_W$1[i - 2];
                const s0 = rotr$1(W15, 7) ^ rotr$1(W15, 18) ^ (W15 >>> 3);
                const s1 = rotr$1(W2, 17) ^ rotr$1(W2, 19) ^ (W2 >>> 10);
                SHA256_W$1[i] = (s1 + SHA256_W$1[i - 7] + s0 + SHA256_W$1[i - 16]) | 0;
            }
            // Compression function main loop, 64 rounds
            let { A, B, C, D, E, F, G, H } = this;
            for (let i = 0; i < 64; i++) {
                const sigma1 = rotr$1(E, 6) ^ rotr$1(E, 11) ^ rotr$1(E, 25);
                const T1 = (H + sigma1 + Chi$1(E, F, G) + SHA256_K$1[i] + SHA256_W$1[i]) | 0;
                const sigma0 = rotr$1(A, 2) ^ rotr$1(A, 13) ^ rotr$1(A, 22);
                const T2 = (sigma0 + Maj$1(A, B, C)) | 0;
                H = G;
                G = F;
                F = E;
                E = (D + T1) | 0;
                D = C;
                C = B;
                B = A;
                A = (T1 + T2) | 0;
            }
            // Add the compressed chunk to the current hash value
            A = (A + this.A) | 0;
            B = (B + this.B) | 0;
            C = (C + this.C) | 0;
            D = (D + this.D) | 0;
            E = (E + this.E) | 0;
            F = (F + this.F) | 0;
            G = (G + this.G) | 0;
            H = (H + this.H) | 0;
            this.set(A, B, C, D, E, F, G, H);
        }
        roundClean() {
            SHA256_W$1.fill(0);
        }
        destroy() {
            this.set(0, 0, 0, 0, 0, 0, 0, 0);
            this.buffer.fill(0);
        }
    };
    // Constants from https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf
    class SHA224 extends SHA256$1 {
        constructor() {
            super();
            this.A = 0xc1059ed8 | 0;
            this.B = 0x367cd507 | 0;
            this.C = 0x3070dd17 | 0;
            this.D = 0xf70e5939 | 0;
            this.E = 0xffc00b31 | 0;
            this.F = 0x68581511 | 0;
            this.G = 0x64f98fa7 | 0;
            this.H = 0xbefa4fa4 | 0;
            this.outputLen = 28;
        }
    }
    /**
     * SHA2-256 hash function
     * @param message - data that would be hashed
     */
    const sha256$1 = wrapConstructor$1(() => new SHA256$1());
    wrapConstructor$1(() => new SHA224());

    /*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    function assertNumber(n) {
        if (!Number.isSafeInteger(n))
            throw new Error(`Wrong integer: ${n}`);
    }
    function chain$1(...args) {
        const wrap = (a, b) => (c) => a(b(c));
        const encode = Array.from(args)
            .reverse()
            .reduce((acc, i) => (acc ? wrap(acc, i.encode) : i.encode), undefined);
        const decode = args.reduce((acc, i) => (acc ? wrap(acc, i.decode) : i.decode), undefined);
        return { encode, decode };
    }
    function alphabet$1(alphabet) {
        return {
            encode: (digits) => {
                if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
                    throw new Error('alphabet.encode input should be an array of numbers');
                return digits.map((i) => {
                    assertNumber(i);
                    if (i < 0 || i >= alphabet.length)
                        throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet.length})`);
                    return alphabet[i];
                });
            },
            decode: (input) => {
                if (!Array.isArray(input) || (input.length && typeof input[0] !== 'string'))
                    throw new Error('alphabet.decode input should be array of strings');
                return input.map((letter) => {
                    if (typeof letter !== 'string')
                        throw new Error(`alphabet.decode: not string element=${letter}`);
                    const index = alphabet.indexOf(letter);
                    if (index === -1)
                        throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet}`);
                    return index;
                });
            },
        };
    }
    function join$1(separator = '') {
        if (typeof separator !== 'string')
            throw new Error('join separator should be string');
        return {
            encode: (from) => {
                if (!Array.isArray(from) || (from.length && typeof from[0] !== 'string'))
                    throw new Error('join.encode input should be array of strings');
                for (let i of from)
                    if (typeof i !== 'string')
                        throw new Error(`join.encode: non-string input=${i}`);
                return from.join(separator);
            },
            decode: (to) => {
                if (typeof to !== 'string')
                    throw new Error('join.decode input should be string');
                return to.split(separator);
            },
        };
    }
    function padding$1(bits, chr = '=') {
        assertNumber(bits);
        if (typeof chr !== 'string')
            throw new Error('padding chr should be string');
        return {
            encode(data) {
                if (!Array.isArray(data) || (data.length && typeof data[0] !== 'string'))
                    throw new Error('padding.encode input should be array of strings');
                for (let i of data)
                    if (typeof i !== 'string')
                        throw new Error(`padding.encode: non-string input=${i}`);
                while ((data.length * bits) % 8)
                    data.push(chr);
                return data;
            },
            decode(input) {
                if (!Array.isArray(input) || (input.length && typeof input[0] !== 'string'))
                    throw new Error('padding.encode input should be array of strings');
                for (let i of input)
                    if (typeof i !== 'string')
                        throw new Error(`padding.decode: non-string input=${i}`);
                let end = input.length;
                if ((end * bits) % 8)
                    throw new Error('Invalid padding: string should have whole number of bytes');
                for (; end > 0 && input[end - 1] === chr; end--) {
                    if (!(((end - 1) * bits) % 8))
                        throw new Error('Invalid padding: string has too much padding');
                }
                return input.slice(0, end);
            },
        };
    }
    function normalize$1(fn) {
        if (typeof fn !== 'function')
            throw new Error('normalize fn should be function');
        return { encode: (from) => from, decode: (to) => fn(to) };
    }
    function convertRadix$1(data, from, to) {
        if (from < 2)
            throw new Error(`convertRadix: wrong from=${from}, base cannot be less than 2`);
        if (to < 2)
            throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
        if (!Array.isArray(data))
            throw new Error('convertRadix: data should be array');
        if (!data.length)
            return [];
        let pos = 0;
        const res = [];
        const digits = Array.from(data);
        digits.forEach((d) => {
            assertNumber(d);
            if (d < 0 || d >= from)
                throw new Error(`Wrong integer: ${d}`);
        });
        while (true) {
            let carry = 0;
            let done = true;
            for (let i = pos; i < digits.length; i++) {
                const digit = digits[i];
                const digitBase = from * carry + digit;
                if (!Number.isSafeInteger(digitBase) ||
                    (from * carry) / from !== carry ||
                    digitBase - digit !== from * carry) {
                    throw new Error('convertRadix: carry overflow');
                }
                carry = digitBase % to;
                digits[i] = Math.floor(digitBase / to);
                if (!Number.isSafeInteger(digits[i]) || digits[i] * to + carry !== digitBase)
                    throw new Error('convertRadix: carry overflow');
                if (!done)
                    continue;
                else if (!digits[i])
                    pos = i;
                else
                    done = false;
            }
            res.push(carry);
            if (done)
                break;
        }
        for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
            res.push(0);
        return res.reverse();
    }
    const gcd$1 = (a, b) => (!b ? a : gcd$1(b, a % b));
    const radix2carry$1 = (from, to) => from + (to - gcd$1(from, to));
    function convertRadix2$1(data, from, to, padding) {
        if (!Array.isArray(data))
            throw new Error('convertRadix2: data should be array');
        if (from <= 0 || from > 32)
            throw new Error(`convertRadix2: wrong from=${from}`);
        if (to <= 0 || to > 32)
            throw new Error(`convertRadix2: wrong to=${to}`);
        if (radix2carry$1(from, to) > 32) {
            throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry$1(from, to)}`);
        }
        let carry = 0;
        let pos = 0;
        const mask = 2 ** to - 1;
        const res = [];
        for (const n of data) {
            assertNumber(n);
            if (n >= 2 ** from)
                throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
            carry = (carry << from) | n;
            if (pos + from > 32)
                throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
            pos += from;
            for (; pos >= to; pos -= to)
                res.push(((carry >> (pos - to)) & mask) >>> 0);
            carry &= 2 ** pos - 1;
        }
        carry = (carry << (to - pos)) & mask;
        if (!padding && pos >= from)
            throw new Error('Excess padding');
        if (!padding && carry)
            throw new Error(`Non-zero padding: ${carry}`);
        if (padding && pos > 0)
            res.push(carry >>> 0);
        return res;
    }
    function radix$1(num) {
        assertNumber(num);
        return {
            encode: (bytes) => {
                if (!(bytes instanceof Uint8Array))
                    throw new Error('radix.encode input should be Uint8Array');
                return convertRadix$1(Array.from(bytes), 2 ** 8, num);
            },
            decode: (digits) => {
                if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
                    throw new Error('radix.decode input should be array of strings');
                return Uint8Array.from(convertRadix$1(digits, num, 2 ** 8));
            },
        };
    }
    function radix2$1(bits, revPadding = false) {
        assertNumber(bits);
        if (bits <= 0 || bits > 32)
            throw new Error('radix2: bits should be in (0..32]');
        if (radix2carry$1(8, bits) > 32 || radix2carry$1(bits, 8) > 32)
            throw new Error('radix2: carry overflow');
        return {
            encode: (bytes) => {
                if (!(bytes instanceof Uint8Array))
                    throw new Error('radix2.encode input should be Uint8Array');
                return convertRadix2$1(Array.from(bytes), 8, bits, !revPadding);
            },
            decode: (digits) => {
                if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
                    throw new Error('radix2.decode input should be array of strings');
                return Uint8Array.from(convertRadix2$1(digits, bits, 8, revPadding));
            },
        };
    }
    function unsafeWrapper$1(fn) {
        if (typeof fn !== 'function')
            throw new Error('unsafeWrapper fn should be function');
        return function (...args) {
            try {
                return fn.apply(null, args);
            }
            catch (e) { }
        };
    }
    const base16 = chain$1(radix2$1(4), alphabet$1('0123456789ABCDEF'), join$1(''));
    const base32 = chain$1(radix2$1(5), alphabet$1('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'), padding$1(5), join$1(''));
    chain$1(radix2$1(5), alphabet$1('0123456789ABCDEFGHIJKLMNOPQRSTUV'), padding$1(5), join$1(''));
    chain$1(radix2$1(5), alphabet$1('0123456789ABCDEFGHJKMNPQRSTVWXYZ'), join$1(''), normalize$1((s) => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')));
    const base64 = chain$1(radix2$1(6), alphabet$1('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'), padding$1(6), join$1(''));
    const base64url = chain$1(radix2$1(6), alphabet$1('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'), padding$1(6), join$1(''));
    const genBase58$1 = (abc) => chain$1(radix$1(58), alphabet$1(abc), join$1(''));
    const base58$1 = genBase58$1('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
    genBase58$1('123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ');
    genBase58$1('rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz');
    const XMR_BLOCK_LEN = [0, 2, 3, 5, 6, 7, 9, 10, 11];
    const base58xmr = {
        encode(data) {
            let res = '';
            for (let i = 0; i < data.length; i += 8) {
                const block = data.subarray(i, i + 8);
                res += base58$1.encode(block).padStart(XMR_BLOCK_LEN[block.length], '1');
            }
            return res;
        },
        decode(str) {
            let res = [];
            for (let i = 0; i < str.length; i += 11) {
                const slice = str.slice(i, i + 11);
                const blockLen = XMR_BLOCK_LEN.indexOf(slice.length);
                const block = base58$1.decode(slice);
                for (let j = 0; j < block.length - blockLen; j++) {
                    if (block[j] !== 0)
                        throw new Error('base58xmr: wrong padding');
                }
                res = res.concat(Array.from(block.slice(block.length - blockLen)));
            }
            return Uint8Array.from(res);
        },
    };
    const BECH_ALPHABET$1 = chain$1(alphabet$1('qpzry9x8gf2tvdw0s3jn54khce6mua7l'), join$1(''));
    const POLYMOD_GENERATORS$1 = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    function bech32Polymod$1(pre) {
        const b = pre >> 25;
        let chk = (pre & 0x1ffffff) << 5;
        for (let i = 0; i < POLYMOD_GENERATORS$1.length; i++) {
            if (((b >> i) & 1) === 1)
                chk ^= POLYMOD_GENERATORS$1[i];
        }
        return chk;
    }
    function bechChecksum$1(prefix, words, encodingConst = 1) {
        const len = prefix.length;
        let chk = 1;
        for (let i = 0; i < len; i++) {
            const c = prefix.charCodeAt(i);
            if (c < 33 || c > 126)
                throw new Error(`Invalid prefix (${prefix})`);
            chk = bech32Polymod$1(chk) ^ (c >> 5);
        }
        chk = bech32Polymod$1(chk);
        for (let i = 0; i < len; i++)
            chk = bech32Polymod$1(chk) ^ (prefix.charCodeAt(i) & 0x1f);
        for (let v of words)
            chk = bech32Polymod$1(chk) ^ v;
        for (let i = 0; i < 6; i++)
            chk = bech32Polymod$1(chk);
        chk ^= encodingConst;
        return BECH_ALPHABET$1.encode(convertRadix2$1([chk % 2 ** 30], 30, 5, false));
    }
    function genBech32$1(encoding) {
        const ENCODING_CONST = encoding === 'bech32' ? 1 : 0x2bc830a3;
        const _words = radix2$1(5);
        const fromWords = _words.decode;
        const toWords = _words.encode;
        const fromWordsUnsafe = unsafeWrapper$1(fromWords);
        function encode(prefix, words, limit = 90) {
            if (typeof prefix !== 'string')
                throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
            if (!Array.isArray(words) || (words.length && typeof words[0] !== 'number'))
                throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
            const actualLength = prefix.length + 7 + words.length;
            if (limit !== false && actualLength > limit)
                throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
            prefix = prefix.toLowerCase();
            return `${prefix}1${BECH_ALPHABET$1.encode(words)}${bechChecksum$1(prefix, words, ENCODING_CONST)}`;
        }
        function decode(str, limit = 90) {
            if (typeof str !== 'string')
                throw new Error(`bech32.decode input should be string, not ${typeof str}`);
            if (str.length < 8 || (limit !== false && str.length > limit))
                throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
            const lowered = str.toLowerCase();
            if (str !== lowered && str !== str.toUpperCase())
                throw new Error(`String must be lowercase or uppercase`);
            str = lowered;
            const sepIndex = str.lastIndexOf('1');
            if (sepIndex === 0 || sepIndex === -1)
                throw new Error(`Letter "1" must be present between prefix and data only`);
            const prefix = str.slice(0, sepIndex);
            const _words = str.slice(sepIndex + 1);
            if (_words.length < 6)
                throw new Error('Data must be at least 6 characters long');
            const words = BECH_ALPHABET$1.decode(_words).slice(0, -6);
            const sum = bechChecksum$1(prefix, words, ENCODING_CONST);
            if (!_words.endsWith(sum))
                throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
            return { prefix, words };
        }
        const decodeUnsafe = unsafeWrapper$1(decode);
        function decodeToBytes(str) {
            const { prefix, words } = decode(str, false);
            return { prefix, words, bytes: fromWords(words) };
        }
        return { encode, decode, decodeToBytes, decodeUnsafe, fromWords, fromWordsUnsafe, toWords };
    }
    const bech32$1 = genBech32$1('bech32');
    genBech32$1('bech32m');
    const utf8 = {
        encode: (data) => new TextDecoder().decode(data),
        decode: (str) => new TextEncoder().encode(str),
    };
    const hex = chain$1(radix2$1(4), alphabet$1('0123456789abcdef'), join$1(''), normalize$1((s) => {
        if (typeof s !== 'string' || s.length % 2)
            throw new TypeError(`hex.decode: expected string, got ${typeof s} with length ${s.length}`);
        return s.toLowerCase();
    }));
    const CODERS = {
        utf8, hex, base16, base32, base64, base64url, base58: base58$1, base58xmr
    };
`Invalid encoding type. Available types: ${Object.keys(CODERS).join(', ')}`;

    const wordlist = `abandon
ability
able
about
above
absent
absorb
abstract
absurd
abuse
access
accident
account
accuse
achieve
acid
acoustic
acquire
across
act
action
actor
actress
actual
adapt
add
addict
address
adjust
admit
adult
advance
advice
aerobic
affair
afford
afraid
again
age
agent
agree
ahead
aim
air
airport
aisle
alarm
album
alcohol
alert
alien
all
alley
allow
almost
alone
alpha
already
also
alter
always
amateur
amazing
among
amount
amused
analyst
anchor
ancient
anger
angle
angry
animal
ankle
announce
annual
another
answer
antenna
antique
anxiety
any
apart
apology
appear
apple
approve
april
arch
arctic
area
arena
argue
arm
armed
armor
army
around
arrange
arrest
arrive
arrow
art
artefact
artist
artwork
ask
aspect
assault
asset
assist
assume
asthma
athlete
atom
attack
attend
attitude
attract
auction
audit
august
aunt
author
auto
autumn
average
avocado
avoid
awake
aware
away
awesome
awful
awkward
axis
baby
bachelor
bacon
badge
bag
balance
balcony
ball
bamboo
banana
banner
bar
barely
bargain
barrel
base
basic
basket
battle
beach
bean
beauty
because
become
beef
before
begin
behave
behind
believe
below
belt
bench
benefit
best
betray
better
between
beyond
bicycle
bid
bike
bind
biology
bird
birth
bitter
black
blade
blame
blanket
blast
bleak
bless
blind
blood
blossom
blouse
blue
blur
blush
board
boat
body
boil
bomb
bone
bonus
book
boost
border
boring
borrow
boss
bottom
bounce
box
boy
bracket
brain
brand
brass
brave
bread
breeze
brick
bridge
brief
bright
bring
brisk
broccoli
broken
bronze
broom
brother
brown
brush
bubble
buddy
budget
buffalo
build
bulb
bulk
bullet
bundle
bunker
burden
burger
burst
bus
business
busy
butter
buyer
buzz
cabbage
cabin
cable
cactus
cage
cake
call
calm
camera
camp
can
canal
cancel
candy
cannon
canoe
canvas
canyon
capable
capital
captain
car
carbon
card
cargo
carpet
carry
cart
case
cash
casino
castle
casual
cat
catalog
catch
category
cattle
caught
cause
caution
cave
ceiling
celery
cement
census
century
cereal
certain
chair
chalk
champion
change
chaos
chapter
charge
chase
chat
cheap
check
cheese
chef
cherry
chest
chicken
chief
child
chimney
choice
choose
chronic
chuckle
chunk
churn
cigar
cinnamon
circle
citizen
city
civil
claim
clap
clarify
claw
clay
clean
clerk
clever
click
client
cliff
climb
clinic
clip
clock
clog
close
cloth
cloud
clown
club
clump
cluster
clutch
coach
coast
coconut
code
coffee
coil
coin
collect
color
column
combine
come
comfort
comic
common
company
concert
conduct
confirm
congress
connect
consider
control
convince
cook
cool
copper
copy
coral
core
corn
correct
cost
cotton
couch
country
couple
course
cousin
cover
coyote
crack
cradle
craft
cram
crane
crash
crater
crawl
crazy
cream
credit
creek
crew
cricket
crime
crisp
critic
crop
cross
crouch
crowd
crucial
cruel
cruise
crumble
crunch
crush
cry
crystal
cube
culture
cup
cupboard
curious
current
curtain
curve
cushion
custom
cute
cycle
dad
damage
damp
dance
danger
daring
dash
daughter
dawn
day
deal
debate
debris
decade
december
decide
decline
decorate
decrease
deer
defense
define
defy
degree
delay
deliver
demand
demise
denial
dentist
deny
depart
depend
deposit
depth
deputy
derive
describe
desert
design
desk
despair
destroy
detail
detect
develop
device
devote
diagram
dial
diamond
diary
dice
diesel
diet
differ
digital
dignity
dilemma
dinner
dinosaur
direct
dirt
disagree
discover
disease
dish
dismiss
disorder
display
distance
divert
divide
divorce
dizzy
doctor
document
dog
doll
dolphin
domain
donate
donkey
donor
door
dose
double
dove
draft
dragon
drama
drastic
draw
dream
dress
drift
drill
drink
drip
drive
drop
drum
dry
duck
dumb
dune
during
dust
dutch
duty
dwarf
dynamic
eager
eagle
early
earn
earth
easily
east
easy
echo
ecology
economy
edge
edit
educate
effort
egg
eight
either
elbow
elder
electric
elegant
element
elephant
elevator
elite
else
embark
embody
embrace
emerge
emotion
employ
empower
empty
enable
enact
end
endless
endorse
enemy
energy
enforce
engage
engine
enhance
enjoy
enlist
enough
enrich
enroll
ensure
enter
entire
entry
envelope
episode
equal
equip
era
erase
erode
erosion
error
erupt
escape
essay
essence
estate
eternal
ethics
evidence
evil
evoke
evolve
exact
example
excess
exchange
excite
exclude
excuse
execute
exercise
exhaust
exhibit
exile
exist
exit
exotic
expand
expect
expire
explain
expose
express
extend
extra
eye
eyebrow
fabric
face
faculty
fade
faint
faith
fall
false
fame
family
famous
fan
fancy
fantasy
farm
fashion
fat
fatal
father
fatigue
fault
favorite
feature
february
federal
fee
feed
feel
female
fence
festival
fetch
fever
few
fiber
fiction
field
figure
file
film
filter
final
find
fine
finger
finish
fire
firm
first
fiscal
fish
fit
fitness
fix
flag
flame
flash
flat
flavor
flee
flight
flip
float
flock
floor
flower
fluid
flush
fly
foam
focus
fog
foil
fold
follow
food
foot
force
forest
forget
fork
fortune
forum
forward
fossil
foster
found
fox
fragile
frame
frequent
fresh
friend
fringe
frog
front
frost
frown
frozen
fruit
fuel
fun
funny
furnace
fury
future
gadget
gain
galaxy
gallery
game
gap
garage
garbage
garden
garlic
garment
gas
gasp
gate
gather
gauge
gaze
general
genius
genre
gentle
genuine
gesture
ghost
giant
gift
giggle
ginger
giraffe
girl
give
glad
glance
glare
glass
glide
glimpse
globe
gloom
glory
glove
glow
glue
goat
goddess
gold
good
goose
gorilla
gospel
gossip
govern
gown
grab
grace
grain
grant
grape
grass
gravity
great
green
grid
grief
grit
grocery
group
grow
grunt
guard
guess
guide
guilt
guitar
gun
gym
habit
hair
half
hammer
hamster
hand
happy
harbor
hard
harsh
harvest
hat
have
hawk
hazard
head
health
heart
heavy
hedgehog
height
hello
helmet
help
hen
hero
hidden
high
hill
hint
hip
hire
history
hobby
hockey
hold
hole
holiday
hollow
home
honey
hood
hope
horn
horror
horse
hospital
host
hotel
hour
hover
hub
huge
human
humble
humor
hundred
hungry
hunt
hurdle
hurry
hurt
husband
hybrid
ice
icon
idea
identify
idle
ignore
ill
illegal
illness
image
imitate
immense
immune
impact
impose
improve
impulse
inch
include
income
increase
index
indicate
indoor
industry
infant
inflict
inform
inhale
inherit
initial
inject
injury
inmate
inner
innocent
input
inquiry
insane
insect
inside
inspire
install
intact
interest
into
invest
invite
involve
iron
island
isolate
issue
item
ivory
jacket
jaguar
jar
jazz
jealous
jeans
jelly
jewel
job
join
joke
journey
joy
judge
juice
jump
jungle
junior
junk
just
kangaroo
keen
keep
ketchup
key
kick
kid
kidney
kind
kingdom
kiss
kit
kitchen
kite
kitten
kiwi
knee
knife
knock
know
lab
label
labor
ladder
lady
lake
lamp
language
laptop
large
later
latin
laugh
laundry
lava
law
lawn
lawsuit
layer
lazy
leader
leaf
learn
leave
lecture
left
leg
legal
legend
leisure
lemon
lend
length
lens
leopard
lesson
letter
level
liar
liberty
library
license
life
lift
light
like
limb
limit
link
lion
liquid
list
little
live
lizard
load
loan
lobster
local
lock
logic
lonely
long
loop
lottery
loud
lounge
love
loyal
lucky
luggage
lumber
lunar
lunch
luxury
lyrics
machine
mad
magic
magnet
maid
mail
main
major
make
mammal
man
manage
mandate
mango
mansion
manual
maple
marble
march
margin
marine
market
marriage
mask
mass
master
match
material
math
matrix
matter
maximum
maze
meadow
mean
measure
meat
mechanic
medal
media
melody
melt
member
memory
mention
menu
mercy
merge
merit
merry
mesh
message
metal
method
middle
midnight
milk
million
mimic
mind
minimum
minor
minute
miracle
mirror
misery
miss
mistake
mix
mixed
mixture
mobile
model
modify
mom
moment
monitor
monkey
monster
month
moon
moral
more
morning
mosquito
mother
motion
motor
mountain
mouse
move
movie
much
muffin
mule
multiply
muscle
museum
mushroom
music
must
mutual
myself
mystery
myth
naive
name
napkin
narrow
nasty
nation
nature
near
neck
need
negative
neglect
neither
nephew
nerve
nest
net
network
neutral
never
news
next
nice
night
noble
noise
nominee
noodle
normal
north
nose
notable
note
nothing
notice
novel
now
nuclear
number
nurse
nut
oak
obey
object
oblige
obscure
observe
obtain
obvious
occur
ocean
october
odor
off
offer
office
often
oil
okay
old
olive
olympic
omit
once
one
onion
online
only
open
opera
opinion
oppose
option
orange
orbit
orchard
order
ordinary
organ
orient
original
orphan
ostrich
other
outdoor
outer
output
outside
oval
oven
over
own
owner
oxygen
oyster
ozone
pact
paddle
page
pair
palace
palm
panda
panel
panic
panther
paper
parade
parent
park
parrot
party
pass
patch
path
patient
patrol
pattern
pause
pave
payment
peace
peanut
pear
peasant
pelican
pen
penalty
pencil
people
pepper
perfect
permit
person
pet
phone
photo
phrase
physical
piano
picnic
picture
piece
pig
pigeon
pill
pilot
pink
pioneer
pipe
pistol
pitch
pizza
place
planet
plastic
plate
play
please
pledge
pluck
plug
plunge
poem
poet
point
polar
pole
police
pond
pony
pool
popular
portion
position
possible
post
potato
pottery
poverty
powder
power
practice
praise
predict
prefer
prepare
present
pretty
prevent
price
pride
primary
print
priority
prison
private
prize
problem
process
produce
profit
program
project
promote
proof
property
prosper
protect
proud
provide
public
pudding
pull
pulp
pulse
pumpkin
punch
pupil
puppy
purchase
purity
purpose
purse
push
put
puzzle
pyramid
quality
quantum
quarter
question
quick
quit
quiz
quote
rabbit
raccoon
race
rack
radar
radio
rail
rain
raise
rally
ramp
ranch
random
range
rapid
rare
rate
rather
raven
raw
razor
ready
real
reason
rebel
rebuild
recall
receive
recipe
record
recycle
reduce
reflect
reform
refuse
region
regret
regular
reject
relax
release
relief
rely
remain
remember
remind
remove
render
renew
rent
reopen
repair
repeat
replace
report
require
rescue
resemble
resist
resource
response
result
retire
retreat
return
reunion
reveal
review
reward
rhythm
rib
ribbon
rice
rich
ride
ridge
rifle
right
rigid
ring
riot
ripple
risk
ritual
rival
river
road
roast
robot
robust
rocket
romance
roof
rookie
room
rose
rotate
rough
round
route
royal
rubber
rude
rug
rule
run
runway
rural
sad
saddle
sadness
safe
sail
salad
salmon
salon
salt
salute
same
sample
sand
satisfy
satoshi
sauce
sausage
save
say
scale
scan
scare
scatter
scene
scheme
school
science
scissors
scorpion
scout
scrap
screen
script
scrub
sea
search
season
seat
second
secret
section
security
seed
seek
segment
select
sell
seminar
senior
sense
sentence
series
service
session
settle
setup
seven
shadow
shaft
shallow
share
shed
shell
sheriff
shield
shift
shine
ship
shiver
shock
shoe
shoot
shop
short
shoulder
shove
shrimp
shrug
shuffle
shy
sibling
sick
side
siege
sight
sign
silent
silk
silly
silver
similar
simple
since
sing
siren
sister
situate
six
size
skate
sketch
ski
skill
skin
skirt
skull
slab
slam
sleep
slender
slice
slide
slight
slim
slogan
slot
slow
slush
small
smart
smile
smoke
smooth
snack
snake
snap
sniff
snow
soap
soccer
social
sock
soda
soft
solar
soldier
solid
solution
solve
someone
song
soon
sorry
sort
soul
sound
soup
source
south
space
spare
spatial
spawn
speak
special
speed
spell
spend
sphere
spice
spider
spike
spin
spirit
split
spoil
sponsor
spoon
sport
spot
spray
spread
spring
spy
square
squeeze
squirrel
stable
stadium
staff
stage
stairs
stamp
stand
start
state
stay
steak
steel
stem
step
stereo
stick
still
sting
stock
stomach
stone
stool
story
stove
strategy
street
strike
strong
struggle
student
stuff
stumble
style
subject
submit
subway
success
such
sudden
suffer
sugar
suggest
suit
summer
sun
sunny
sunset
super
supply
supreme
sure
surface
surge
surprise
surround
survey
suspect
sustain
swallow
swamp
swap
swarm
swear
sweet
swift
swim
swing
switch
sword
symbol
symptom
syrup
system
table
tackle
tag
tail
talent
talk
tank
tape
target
task
taste
tattoo
taxi
teach
team
tell
ten
tenant
tennis
tent
term
test
text
thank
that
theme
then
theory
there
they
thing
this
thought
three
thrive
throw
thumb
thunder
ticket
tide
tiger
tilt
timber
time
tiny
tip
tired
tissue
title
toast
tobacco
today
toddler
toe
together
toilet
token
tomato
tomorrow
tone
tongue
tonight
tool
tooth
top
topic
topple
torch
tornado
tortoise
toss
total
tourist
toward
tower
town
toy
track
trade
traffic
tragic
train
transfer
trap
trash
travel
tray
treat
tree
trend
trial
tribe
trick
trigger
trim
trip
trophy
trouble
truck
true
truly
trumpet
trust
truth
try
tube
tuition
tumble
tuna
tunnel
turkey
turn
turtle
twelve
twenty
twice
twin
twist
two
type
typical
ugly
umbrella
unable
unaware
uncle
uncover
under
undo
unfair
unfold
unhappy
uniform
unique
unit
universe
unknown
unlock
until
unusual
unveil
update
upgrade
uphold
upon
upper
upset
urban
urge
usage
use
used
useful
useless
usual
utility
vacant
vacuum
vague
valid
valley
valve
van
vanish
vapor
various
vast
vault
vehicle
velvet
vendor
venture
venue
verb
verify
version
very
vessel
veteran
viable
vibrant
vicious
victory
video
view
village
vintage
violin
virtual
virus
visa
visit
visual
vital
vivid
vocal
voice
void
volcano
volume
vote
voyage
wage
wagon
wait
walk
wall
walnut
want
warfare
warm
warrior
wash
wasp
waste
water
wave
way
wealth
weapon
wear
weasel
weather
web
wedding
weekend
weird
welcome
west
wet
whale
what
wheat
wheel
when
where
whip
whisper
wide
width
wife
wild
will
win
window
wine
wing
wink
winner
winter
wire
wisdom
wise
wish
witness
wolf
woman
wonder
wood
wool
word
work
world
worry
worth
wrap
wreck
wrestle
wrist
write
wrong
yard
year
yellow
you
young
youth
zebra
zero
zone
zoo`.split('\n');

    function number$1(n) {
        if (!Number.isSafeInteger(n) || n < 0)
            throw new Error(`Wrong positive integer: ${n}`);
    }
    function bool$1(b) {
        if (typeof b !== 'boolean')
            throw new Error(`Expected boolean, not ${b}`);
    }
    // copied from utils
    function isBytes$2(a) {
        return (a instanceof Uint8Array ||
            (a != null && typeof a === 'object' && a.constructor.name === 'Uint8Array'));
    }
    function bytes$1(b, ...lengths) {
        if (!isBytes$2(b))
            throw new Error('Expected Uint8Array');
        if (lengths.length > 0 && !lengths.includes(b.length))
            throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
    }
    function hash$1(hash) {
        if (typeof hash !== 'function' || typeof hash.create !== 'function')
            throw new Error('Hash should be wrapped by utils.wrapConstructor');
        number$1(hash.outputLen);
        number$1(hash.blockLen);
    }
    function exists$1(instance, checkFinished = true) {
        if (instance.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (checkFinished && instance.finished)
            throw new Error('Hash#digest() has already been called');
    }
    function output$1(out, instance) {
        bytes$1(out);
        const min = instance.outputLen;
        if (out.length < min) {
            throw new Error(`digestInto() expects output buffer of length at least ${min}`);
        }
    }
    const assert$1 = { number: number$1, bool: bool$1, bytes: bytes$1, hash: hash$1, exists: exists$1, output: output$1 };

    const crypto$1 = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
    // node.js versions earlier than v19 don't declare it in global scope.
    // For node.js, package.json#exports field mapping rewrites import
    // from `crypto` to `cryptoNode`, which imports native module.
    // Makes the utils un-importable in browsers without a bundler.
    // Once node.js 18 is deprecated (2025-04-30), we can just drop the import.
    function isBytes$1(a) {
        return (a instanceof Uint8Array ||
            (a != null && typeof a === 'object' && a.constructor.name === 'Uint8Array'));
    }
    // Cast array to view
    const createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    // The rotate right (circular right shift) operation for uint32
    const rotr = (word, shift) => (word << (32 - shift)) | (word >>> shift);
    // big-endian hardware is rare. Just in case someone still decides to run hashes:
    // early-throw an error because we don't support BE yet.
    // Other libraries would silently corrupt the data instead of throwing an error,
    // when they don't support it.
    const isLE$1 = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
    if (!isLE$1)
        throw new Error('Non little-endian hardware is not supported');
    // Array where index 0xf0 (240) is mapped to string 'f0'
    const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
    /**
     * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
     */
    function bytesToHex(bytes) {
        if (!isBytes$1(bytes))
            throw new Error('Uint8Array expected');
        // pre-caching improves the speed 6x
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += hexes[bytes[i]];
        }
        return hex;
    }
    // We use optimized technique to convert hex string to byte array
    const asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
    function asciiToBase16(char) {
        if (char >= asciis._0 && char <= asciis._9)
            return char - asciis._0;
        if (char >= asciis._A && char <= asciis._F)
            return char - (asciis._A - 10);
        if (char >= asciis._a && char <= asciis._f)
            return char - (asciis._a - 10);
        return;
    }
    /**
     * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
     */
    function hexToBytes(hex) {
        if (typeof hex !== 'string')
            throw new Error('hex string expected, got ' + typeof hex);
        const hl = hex.length;
        const al = hl / 2;
        if (hl % 2)
            throw new Error('padded hex string expected, got unpadded hex of length ' + hl);
        const array = new Uint8Array(al);
        for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
            const n1 = asciiToBase16(hex.charCodeAt(hi));
            const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
            if (n1 === undefined || n2 === undefined) {
                const char = hex[hi] + hex[hi + 1];
                throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
            }
            array[ai] = n1 * 16 + n2;
        }
        return array;
    }
    /**
     * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
     */
    function utf8ToBytes$1(str) {
        if (typeof str !== 'string')
            throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
        return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
    }
    /**
     * Normalizes (non-hex) string or Uint8Array to Uint8Array.
     * Warning: when Uint8Array is passed, it would NOT get copied.
     * Keep in mind for future mutable operations.
     */
    function toBytes$1(data) {
        if (typeof data === 'string')
            data = utf8ToBytes$1(data);
        if (!isBytes$1(data))
            throw new Error(`expected Uint8Array, got ${typeof data}`);
        return data;
    }
    /**
     * Copies several Uint8Arrays into one.
     */
    function concatBytes(...arrays) {
        let sum = 0;
        for (let i = 0; i < arrays.length; i++) {
            const a = arrays[i];
            if (!isBytes$1(a))
                throw new Error('Uint8Array expected');
            sum += a.length;
        }
        const res = new Uint8Array(sum);
        for (let i = 0, pad = 0; i < arrays.length; i++) {
            const a = arrays[i];
            res.set(a, pad);
            pad += a.length;
        }
        return res;
    }
    // For runtime check if class implements interface
    class Hash {
        // Safe version that clones internal state
        clone() {
            return this._cloneInto();
        }
    }
    const toStr = {}.toString;
    function checkOpts$1(defaults, opts) {
        if (opts !== undefined && toStr.call(opts) !== '[object Object]')
            throw new Error('Options should be object or undefined');
        const merged = Object.assign(defaults, opts);
        return merged;
    }
    function wrapConstructor(hashCons) {
        const hashC = (msg) => hashCons().update(toBytes$1(msg)).digest();
        const tmp = hashCons();
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = () => hashCons();
        return hashC;
    }
    /**
     * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
     */
    function randomBytes(bytesLength = 32) {
        if (crypto$1 && typeof crypto$1.getRandomValues === 'function') {
            return crypto$1.getRandomValues(new Uint8Array(bytesLength));
        }
        throw new Error('crypto.getRandomValues must be defined');
    }

    // HMAC (RFC 2104)
    let HMAC$1 = class HMAC extends Hash {
        constructor(hash, _key) {
            super();
            this.finished = false;
            this.destroyed = false;
            hash$1(hash);
            const key = toBytes$1(_key);
            this.iHash = hash.create();
            if (typeof this.iHash.update !== 'function')
                throw new Error('Expected instance of class which extends utils.Hash');
            this.blockLen = this.iHash.blockLen;
            this.outputLen = this.iHash.outputLen;
            const blockLen = this.blockLen;
            const pad = new Uint8Array(blockLen);
            // blockLen can be bigger than outputLen
            pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36;
            this.iHash.update(pad);
            // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
            this.oHash = hash.create();
            // Undo internal XOR && apply outer XOR
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36 ^ 0x5c;
            this.oHash.update(pad);
            pad.fill(0);
        }
        update(buf) {
            exists$1(this);
            this.iHash.update(buf);
            return this;
        }
        digestInto(out) {
            exists$1(this);
            bytes$1(out, this.outputLen);
            this.finished = true;
            this.iHash.digestInto(out);
            this.oHash.update(out);
            this.oHash.digestInto(out);
            this.destroy();
        }
        digest() {
            const out = new Uint8Array(this.oHash.outputLen);
            this.digestInto(out);
            return out;
        }
        _cloneInto(to) {
            // Create new instance without calling constructor since key already in state and we don't know it.
            to || (to = Object.create(Object.getPrototypeOf(this), {}));
            const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
            to = to;
            to.finished = finished;
            to.destroyed = destroyed;
            to.blockLen = blockLen;
            to.outputLen = outputLen;
            to.oHash = oHash._cloneInto(to.oHash);
            to.iHash = iHash._cloneInto(to.iHash);
            return to;
        }
        destroy() {
            this.destroyed = true;
            this.oHash.destroy();
            this.iHash.destroy();
        }
    };
    /**
     * HMAC: RFC2104 message authentication code.
     * @param hash - function that would be used e.g. sha256
     * @param key - message key
     * @param message - message data
     */
    const hmac$1 = (hash, key, message) => new HMAC$1(hash, key).update(message).digest();
    hmac$1.create = (hash, key) => new HMAC$1(hash, key);

    // Common prologue and epilogue for sync/async functions
    function pbkdf2Init(hash, _password, _salt, _opts) {
        hash$1(hash);
        const opts = checkOpts$1({ dkLen: 32, asyncTick: 10 }, _opts);
        const { c, dkLen, asyncTick } = opts;
        number$1(c);
        number$1(dkLen);
        number$1(asyncTick);
        if (c < 1)
            throw new Error('PBKDF2: iterations (c) should be >= 1');
        const password = toBytes$1(_password);
        const salt = toBytes$1(_salt);
        // DK = PBKDF2(PRF, Password, Salt, c, dkLen);
        const DK = new Uint8Array(dkLen);
        // U1 = PRF(Password, Salt + INT_32_BE(i))
        const PRF = hmac$1.create(hash, password);
        const PRFSalt = PRF._cloneInto().update(salt);
        return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
    }
    function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
        PRF.destroy();
        PRFSalt.destroy();
        if (prfW)
            prfW.destroy();
        u.fill(0);
        return DK;
    }
    /**
     * PBKDF2-HMAC: RFC 2898 key derivation function
     * @param hash - hash function that would be used e.g. sha256
     * @param password - password from which a derived key is generated
     * @param salt - cryptographic salt
     * @param opts - {c, dkLen} where c is work factor and dkLen is output message size
     */
    function pbkdf2(hash, password, salt, opts) {
        const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts);
        let prfW; // Working copy
        const arr = new Uint8Array(4);
        const view = createView(arr);
        const u = new Uint8Array(PRF.outputLen);
        // DK = T1 + T2 + ⋯ + Tdklen/hlen
        for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
            // Ti = F(Password, Salt, c, i)
            const Ti = DK.subarray(pos, pos + PRF.outputLen);
            view.setInt32(0, ti, false);
            // F(Password, Salt, c, i) = U1 ^ U2 ^ ⋯ ^ Uc
            // U1 = PRF(Password, Salt + INT_32_BE(i))
            (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
            Ti.set(u.subarray(0, Ti.length));
            for (let ui = 1; ui < c; ui++) {
                // Uc = PRF(Password, Uc−1)
                PRF._cloneInto(prfW).update(u).digestInto(u);
                for (let i = 0; i < Ti.length; i++)
                    Ti[i] ^= u[i];
            }
        }
        return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
    }

    // Polyfill for Safari 14
    function setBigUint64(view, byteOffset, value, isLE) {
        if (typeof view.setBigUint64 === 'function')
            return view.setBigUint64(byteOffset, value, isLE);
        const _32n = BigInt(32);
        const _u32_max = BigInt(0xffffffff);
        const wh = Number((value >> _32n) & _u32_max);
        const wl = Number(value & _u32_max);
        const h = isLE ? 4 : 0;
        const l = isLE ? 0 : 4;
        view.setUint32(byteOffset + h, wh, isLE);
        view.setUint32(byteOffset + l, wl, isLE);
    }
    // Base SHA2 class (RFC 6234)
    class SHA2 extends Hash {
        constructor(blockLen, outputLen, padOffset, isLE) {
            super();
            this.blockLen = blockLen;
            this.outputLen = outputLen;
            this.padOffset = padOffset;
            this.isLE = isLE;
            this.finished = false;
            this.length = 0;
            this.pos = 0;
            this.destroyed = false;
            this.buffer = new Uint8Array(blockLen);
            this.view = createView(this.buffer);
        }
        update(data) {
            exists$1(this);
            const { view, buffer, blockLen } = this;
            data = toBytes$1(data);
            const len = data.length;
            for (let pos = 0; pos < len;) {
                const take = Math.min(blockLen - this.pos, len - pos);
                // Fast path: we have at least one block in input, cast it to view and process
                if (take === blockLen) {
                    const dataView = createView(data);
                    for (; blockLen <= len - pos; pos += blockLen)
                        this.process(dataView, pos);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                pos += take;
                if (this.pos === blockLen) {
                    this.process(view, 0);
                    this.pos = 0;
                }
            }
            this.length += data.length;
            this.roundClean();
            return this;
        }
        digestInto(out) {
            exists$1(this);
            output$1(out, this);
            this.finished = true;
            // Padding
            // We can avoid allocation of buffer for padding completely if it
            // was previously not allocated here. But it won't change performance.
            const { buffer, view, blockLen, isLE } = this;
            let { pos } = this;
            // append the bit '1' to the message
            buffer[pos++] = 0b10000000;
            this.buffer.subarray(pos).fill(0);
            // we have less than padOffset left in buffer, so we cannot put length in current block, need process it and pad again
            if (this.padOffset > blockLen - pos) {
                this.process(view, 0);
                pos = 0;
            }
            // Pad until full block byte with zeros
            for (let i = pos; i < blockLen; i++)
                buffer[i] = 0;
            // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
            // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
            // So we just write lowest 64 bits of that value.
            setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
            this.process(view, 0);
            const oview = createView(out);
            const len = this.outputLen;
            // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
            if (len % 4)
                throw new Error('_sha2: outputLen should be aligned to 32bit');
            const outLen = len / 4;
            const state = this.get();
            if (outLen > state.length)
                throw new Error('_sha2: outputLen bigger than state');
            for (let i = 0; i < outLen; i++)
                oview.setUint32(4 * i, state[i], isLE);
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
        _cloneInto(to) {
            to || (to = new this.constructor());
            to.set(...this.get());
            const { blockLen, buffer, length, finished, destroyed, pos } = this;
            to.length = length;
            to.pos = pos;
            to.finished = finished;
            to.destroyed = destroyed;
            if (length % blockLen)
                to.buffer.set(buffer);
            return to;
        }
    }

    // SHA2-256 need to try 2^128 hashes to execute birthday attack.
    // BTC network is doing 2^67 hashes/sec as per early 2023.
    // Choice: a ? b : c
    const Chi = (a, b, c) => (a & b) ^ (~a & c);
    // Majority function, true if any two inpust is true
    const Maj = (a, b, c) => (a & b) ^ (a & c) ^ (b & c);
    // Round constants:
    // first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311)
    // prettier-ignore
    const SHA256_K = /* @__PURE__ */ new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    // Initial state (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
    // prettier-ignore
    const IV = /* @__PURE__ */ new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    // Temporary buffer, not used to store anything between runs
    // Named this way because it matches specification.
    const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    class SHA256 extends SHA2 {
        constructor() {
            super(64, 32, 8, false);
            // We cannot use array here since array allows indexing by variable
            // which means optimizer/compiler cannot use registers.
            this.A = IV[0] | 0;
            this.B = IV[1] | 0;
            this.C = IV[2] | 0;
            this.D = IV[3] | 0;
            this.E = IV[4] | 0;
            this.F = IV[5] | 0;
            this.G = IV[6] | 0;
            this.H = IV[7] | 0;
        }
        get() {
            const { A, B, C, D, E, F, G, H } = this;
            return [A, B, C, D, E, F, G, H];
        }
        // prettier-ignore
        set(A, B, C, D, E, F, G, H) {
            this.A = A | 0;
            this.B = B | 0;
            this.C = C | 0;
            this.D = D | 0;
            this.E = E | 0;
            this.F = F | 0;
            this.G = G | 0;
            this.H = H | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4)
                SHA256_W[i] = view.getUint32(offset, false);
            for (let i = 16; i < 64; i++) {
                const W15 = SHA256_W[i - 15];
                const W2 = SHA256_W[i - 2];
                const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
                const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
                SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
            }
            // Compression function main loop, 64 rounds
            let { A, B, C, D, E, F, G, H } = this;
            for (let i = 0; i < 64; i++) {
                const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
                const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
                const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
                const T2 = (sigma0 + Maj(A, B, C)) | 0;
                H = G;
                G = F;
                F = E;
                E = (D + T1) | 0;
                D = C;
                C = B;
                B = A;
                A = (T1 + T2) | 0;
            }
            // Add the compressed chunk to the current hash value
            A = (A + this.A) | 0;
            B = (B + this.B) | 0;
            C = (C + this.C) | 0;
            D = (D + this.D) | 0;
            E = (E + this.E) | 0;
            F = (F + this.F) | 0;
            G = (G + this.G) | 0;
            H = (H + this.H) | 0;
            this.set(A, B, C, D, E, F, G, H);
        }
        roundClean() {
            SHA256_W.fill(0);
        }
        destroy() {
            this.set(0, 0, 0, 0, 0, 0, 0, 0);
            this.buffer.fill(0);
        }
    }
    /**
     * SHA2-256 hash function
     * @param message - data that would be hashed
     */
    const sha256 = /* @__PURE__ */ wrapConstructor(() => new SHA256());

    const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    const _32n = /* @__PURE__ */ BigInt(32);
    // We are not using BigUint64Array, because they are extremely slow as per 2022
    function fromBig(n, le = false) {
        if (le)
            return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
        return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
    }
    function split(lst, le = false) {
        let Ah = new Uint32Array(lst.length);
        let Al = new Uint32Array(lst.length);
        for (let i = 0; i < lst.length; i++) {
            const { h, l } = fromBig(lst[i], le);
            [Ah[i], Al[i]] = [h, l];
        }
        return [Ah, Al];
    }
    const toBig = (h, l) => (BigInt(h >>> 0) << _32n) | BigInt(l >>> 0);
    // for Shift in [0, 32)
    const shrSH = (h, _l, s) => h >>> s;
    const shrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
    // Right rotate for Shift in [1, 32)
    const rotrSH = (h, l, s) => (h >>> s) | (l << (32 - s));
    const rotrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
    // Right rotate for Shift in (32, 64), NOTE: 32 is special case.
    const rotrBH = (h, l, s) => (h << (64 - s)) | (l >>> (s - 32));
    const rotrBL = (h, l, s) => (h >>> (s - 32)) | (l << (64 - s));
    // Right rotate for shift===32 (just swaps l&h)
    const rotr32H = (_h, l) => l;
    const rotr32L = (h, _l) => h;
    // Left rotate for Shift in [1, 32)
    const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
    const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
    // Left rotate for Shift in (32, 64), NOTE: 32 is special case.
    const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
    const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));
    // JS uses 32-bit signed integers for bitwise operations which means we cannot
    // simple take carry out of low bit sum by shift, we need to use division.
    function add(Ah, Al, Bh, Bl) {
        const l = (Al >>> 0) + (Bl >>> 0);
        return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
    }
    // Addition with more than 2 elements
    const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
    const add3H = (low, Ah, Bh, Ch) => (Ah + Bh + Ch + ((low / 2 ** 32) | 0)) | 0;
    const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
    const add4H = (low, Ah, Bh, Ch, Dh) => (Ah + Bh + Ch + Dh + ((low / 2 ** 32) | 0)) | 0;
    const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
    const add5H = (low, Ah, Bh, Ch, Dh, Eh) => (Ah + Bh + Ch + Dh + Eh + ((low / 2 ** 32) | 0)) | 0;
    // prettier-ignore
    const u64 = {
        fromBig, split, toBig,
        shrSH, shrSL,
        rotrSH, rotrSL, rotrBH, rotrBL,
        rotr32H, rotr32L,
        rotlSH, rotlSL, rotlBH, rotlBL,
        add, add3L, add3H, add4L, add4H, add5H, add5L,
    };

    // Round contants (first 32 bits of the fractional parts of the cube roots of the first 80 primes 2..409):
    // prettier-ignore
    const [SHA512_Kh, SHA512_Kl] = /* @__PURE__ */ (() => u64.split([
        '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
        '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
        '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
        '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
        '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
        '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
        '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
        '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
        '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
        '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
        '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
        '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
        '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
        '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
        '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
        '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
        '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
        '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
        '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
        '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
    ].map(n => BigInt(n))))();
    // Temporary buffer, not used to store anything between runs
    const SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
    const SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
    class SHA512 extends SHA2 {
        constructor() {
            super(128, 64, 16, false);
            // We cannot use array here since array allows indexing by variable which means optimizer/compiler cannot use registers.
            // Also looks cleaner and easier to verify with spec.
            // Initial state (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
            // h -- high 32 bits, l -- low 32 bits
            this.Ah = 0x6a09e667 | 0;
            this.Al = 0xf3bcc908 | 0;
            this.Bh = 0xbb67ae85 | 0;
            this.Bl = 0x84caa73b | 0;
            this.Ch = 0x3c6ef372 | 0;
            this.Cl = 0xfe94f82b | 0;
            this.Dh = 0xa54ff53a | 0;
            this.Dl = 0x5f1d36f1 | 0;
            this.Eh = 0x510e527f | 0;
            this.El = 0xade682d1 | 0;
            this.Fh = 0x9b05688c | 0;
            this.Fl = 0x2b3e6c1f | 0;
            this.Gh = 0x1f83d9ab | 0;
            this.Gl = 0xfb41bd6b | 0;
            this.Hh = 0x5be0cd19 | 0;
            this.Hl = 0x137e2179 | 0;
        }
        // prettier-ignore
        get() {
            const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
            return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
        }
        // prettier-ignore
        set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
            this.Ah = Ah | 0;
            this.Al = Al | 0;
            this.Bh = Bh | 0;
            this.Bl = Bl | 0;
            this.Ch = Ch | 0;
            this.Cl = Cl | 0;
            this.Dh = Dh | 0;
            this.Dl = Dl | 0;
            this.Eh = Eh | 0;
            this.El = El | 0;
            this.Fh = Fh | 0;
            this.Fl = Fl | 0;
            this.Gh = Gh | 0;
            this.Gl = Gl | 0;
            this.Hh = Hh | 0;
            this.Hl = Hl | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4) {
                SHA512_W_H[i] = view.getUint32(offset);
                SHA512_W_L[i] = view.getUint32((offset += 4));
            }
            for (let i = 16; i < 80; i++) {
                // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
                const W15h = SHA512_W_H[i - 15] | 0;
                const W15l = SHA512_W_L[i - 15] | 0;
                const s0h = u64.rotrSH(W15h, W15l, 1) ^ u64.rotrSH(W15h, W15l, 8) ^ u64.shrSH(W15h, W15l, 7);
                const s0l = u64.rotrSL(W15h, W15l, 1) ^ u64.rotrSL(W15h, W15l, 8) ^ u64.shrSL(W15h, W15l, 7);
                // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
                const W2h = SHA512_W_H[i - 2] | 0;
                const W2l = SHA512_W_L[i - 2] | 0;
                const s1h = u64.rotrSH(W2h, W2l, 19) ^ u64.rotrBH(W2h, W2l, 61) ^ u64.shrSH(W2h, W2l, 6);
                const s1l = u64.rotrSL(W2h, W2l, 19) ^ u64.rotrBL(W2h, W2l, 61) ^ u64.shrSL(W2h, W2l, 6);
                // SHA256_W[i] = s0 + s1 + SHA256_W[i - 7] + SHA256_W[i - 16];
                const SUMl = u64.add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
                const SUMh = u64.add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
                SHA512_W_H[i] = SUMh | 0;
                SHA512_W_L[i] = SUMl | 0;
            }
            let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
            // Compression function main loop, 80 rounds
            for (let i = 0; i < 80; i++) {
                // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
                const sigma1h = u64.rotrSH(Eh, El, 14) ^ u64.rotrSH(Eh, El, 18) ^ u64.rotrBH(Eh, El, 41);
                const sigma1l = u64.rotrSL(Eh, El, 14) ^ u64.rotrSL(Eh, El, 18) ^ u64.rotrBL(Eh, El, 41);
                //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
                const CHIh = (Eh & Fh) ^ (~Eh & Gh);
                const CHIl = (El & Fl) ^ (~El & Gl);
                // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
                // prettier-ignore
                const T1ll = u64.add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
                const T1h = u64.add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
                const T1l = T1ll | 0;
                // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
                const sigma0h = u64.rotrSH(Ah, Al, 28) ^ u64.rotrBH(Ah, Al, 34) ^ u64.rotrBH(Ah, Al, 39);
                const sigma0l = u64.rotrSL(Ah, Al, 28) ^ u64.rotrBL(Ah, Al, 34) ^ u64.rotrBL(Ah, Al, 39);
                const MAJh = (Ah & Bh) ^ (Ah & Ch) ^ (Bh & Ch);
                const MAJl = (Al & Bl) ^ (Al & Cl) ^ (Bl & Cl);
                Hh = Gh | 0;
                Hl = Gl | 0;
                Gh = Fh | 0;
                Gl = Fl | 0;
                Fh = Eh | 0;
                Fl = El | 0;
                ({ h: Eh, l: El } = u64.add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
                Dh = Ch | 0;
                Dl = Cl | 0;
                Ch = Bh | 0;
                Cl = Bl | 0;
                Bh = Ah | 0;
                Bl = Al | 0;
                const All = u64.add3L(T1l, sigma0l, MAJl);
                Ah = u64.add3H(All, T1h, sigma0h, MAJh);
                Al = All | 0;
            }
            // Add the compressed chunk to the current hash value
            ({ h: Ah, l: Al } = u64.add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
            ({ h: Bh, l: Bl } = u64.add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
            ({ h: Ch, l: Cl } = u64.add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
            ({ h: Dh, l: Dl } = u64.add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
            ({ h: Eh, l: El } = u64.add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
            ({ h: Fh, l: Fl } = u64.add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
            ({ h: Gh, l: Gl } = u64.add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
            ({ h: Hh, l: Hl } = u64.add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
            this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
        }
        roundClean() {
            SHA512_W_H.fill(0);
            SHA512_W_L.fill(0);
        }
        destroy() {
            this.buffer.fill(0);
            this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }
    const sha512 = /* @__PURE__ */ wrapConstructor(() => new SHA512());

    /*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    // Utilities

    function isBytes(a) {
        return (a instanceof Uint8Array ||
            (a != null && typeof a === 'object' && a.constructor.name === 'Uint8Array'));
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function chain(...args) {
        const id = (a) => a;
        // Wrap call in closure so JIT can inline calls
        const wrap = (a, b) => (c) => a(b(c));
        // Construct chain of args[-1].encode(args[-2].encode([...]))
        const encode = args.map((x) => x.encode).reduceRight(wrap, id);
        // Construct chain of args[0].decode(args[1].decode(...))
        const decode = args.map((x) => x.decode).reduce(wrap, id);
        return { encode, decode };
    }
    /**
     * Encodes integer radix representation to array of strings using alphabet and back
     * @__NO_SIDE_EFFECTS__
     */
    function alphabet(alphabet) {
        return {
            encode: (digits) => {
                if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
                    throw new Error('alphabet.encode input should be an array of numbers');
                return digits.map((i) => {
                    if (i < 0 || i >= alphabet.length)
                        throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet.length})`);
                    return alphabet[i];
                });
            },
            decode: (input) => {
                if (!Array.isArray(input) || (input.length && typeof input[0] !== 'string'))
                    throw new Error('alphabet.decode input should be array of strings');
                return input.map((letter) => {
                    if (typeof letter !== 'string')
                        throw new Error(`alphabet.decode: not string element=${letter}`);
                    const index = alphabet.indexOf(letter);
                    if (index === -1)
                        throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet}`);
                    return index;
                });
            },
        };
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function join(separator = '') {
        if (typeof separator !== 'string')
            throw new Error('join separator should be string');
        return {
            encode: (from) => {
                if (!Array.isArray(from) || (from.length && typeof from[0] !== 'string'))
                    throw new Error('join.encode input should be array of strings');
                for (let i of from)
                    if (typeof i !== 'string')
                        throw new Error(`join.encode: non-string input=${i}`);
                return from.join(separator);
            },
            decode: (to) => {
                if (typeof to !== 'string')
                    throw new Error('join.decode input should be string');
                return to.split(separator);
            },
        };
    }
    /**
     * Pad strings array so it has integer number of bits
     * @__NO_SIDE_EFFECTS__
     */
    function padding(bits, chr = '=') {
        if (typeof chr !== 'string')
            throw new Error('padding chr should be string');
        return {
            encode(data) {
                if (!Array.isArray(data) || (data.length && typeof data[0] !== 'string'))
                    throw new Error('padding.encode input should be array of strings');
                for (let i of data)
                    if (typeof i !== 'string')
                        throw new Error(`padding.encode: non-string input=${i}`);
                while ((data.length * bits) % 8)
                    data.push(chr);
                return data;
            },
            decode(input) {
                if (!Array.isArray(input) || (input.length && typeof input[0] !== 'string'))
                    throw new Error('padding.encode input should be array of strings');
                for (let i of input)
                    if (typeof i !== 'string')
                        throw new Error(`padding.decode: non-string input=${i}`);
                let end = input.length;
                if ((end * bits) % 8)
                    throw new Error('Invalid padding: string should have whole number of bytes');
                for (; end > 0 && input[end - 1] === chr; end--) {
                    if (!(((end - 1) * bits) % 8))
                        throw new Error('Invalid padding: string has too much padding');
                }
                return input.slice(0, end);
            },
        };
    }
    /**
     * Slow: O(n^2) time complexity
     * @__NO_SIDE_EFFECTS__
     */
    function convertRadix(data, from, to) {
        // base 1 is impossible
        if (from < 2)
            throw new Error(`convertRadix: wrong from=${from}, base cannot be less than 2`);
        if (to < 2)
            throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
        if (!Array.isArray(data))
            throw new Error('convertRadix: data should be array');
        if (!data.length)
            return [];
        let pos = 0;
        const res = [];
        const digits = Array.from(data);
        digits.forEach((d) => {
            if (d < 0 || d >= from)
                throw new Error(`Wrong integer: ${d}`);
        });
        while (true) {
            let carry = 0;
            let done = true;
            for (let i = pos; i < digits.length; i++) {
                const digit = digits[i];
                const digitBase = from * carry + digit;
                if (!Number.isSafeInteger(digitBase) ||
                    (from * carry) / from !== carry ||
                    digitBase - digit !== from * carry) {
                    throw new Error('convertRadix: carry overflow');
                }
                carry = digitBase % to;
                const rounded = Math.floor(digitBase / to);
                digits[i] = rounded;
                if (!Number.isSafeInteger(rounded) || rounded * to + carry !== digitBase)
                    throw new Error('convertRadix: carry overflow');
                if (!done)
                    continue;
                else if (!rounded)
                    pos = i;
                else
                    done = false;
            }
            res.push(carry);
            if (done)
                break;
        }
        for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
            res.push(0);
        return res.reverse();
    }
    const gcd = /* @__NO_SIDE_EFFECTS__ */ (a, b) => (!b ? a : gcd(b, a % b));
    const radix2carry = /*@__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - gcd(from, to));
    /**
     * Implemented with numbers, because BigInt is 5x slower
     * @__NO_SIDE_EFFECTS__
     */
    function convertRadix2(data, from, to, padding) {
        if (!Array.isArray(data))
            throw new Error('convertRadix2: data should be array');
        if (from <= 0 || from > 32)
            throw new Error(`convertRadix2: wrong from=${from}`);
        if (to <= 0 || to > 32)
            throw new Error(`convertRadix2: wrong to=${to}`);
        if (radix2carry(from, to) > 32) {
            throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
        }
        let carry = 0;
        let pos = 0; // bitwise position in current element
        const mask = 2 ** to - 1;
        const res = [];
        for (const n of data) {
            if (n >= 2 ** from)
                throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
            carry = (carry << from) | n;
            if (pos + from > 32)
                throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
            pos += from;
            for (; pos >= to; pos -= to)
                res.push(((carry >> (pos - to)) & mask) >>> 0);
            carry &= 2 ** pos - 1; // clean carry, otherwise it will cause overflow
        }
        carry = (carry << (to - pos)) & mask;
        if (!padding && pos >= from)
            throw new Error('Excess padding');
        if (!padding && carry)
            throw new Error(`Non-zero padding: ${carry}`);
        if (padding && pos > 0)
            res.push(carry >>> 0);
        return res;
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function radix(num) {
        return {
            encode: (bytes) => {
                if (!isBytes(bytes))
                    throw new Error('radix.encode input should be Uint8Array');
                return convertRadix(Array.from(bytes), 2 ** 8, num);
            },
            decode: (digits) => {
                if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
                    throw new Error('radix.decode input should be array of numbers');
                return Uint8Array.from(convertRadix(digits, num, 2 ** 8));
            },
        };
    }
    /**
     * If both bases are power of same number (like `2**8 <-> 2**64`),
     * there is a linear algorithm. For now we have implementation for power-of-two bases only.
     * @__NO_SIDE_EFFECTS__
     */
    function radix2(bits, revPadding = false) {
        if (bits <= 0 || bits > 32)
            throw new Error('radix2: bits should be in (0..32]');
        if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
            throw new Error('radix2: carry overflow');
        return {
            encode: (bytes) => {
                if (!isBytes(bytes))
                    throw new Error('radix2.encode input should be Uint8Array');
                return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
            },
            decode: (digits) => {
                if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
                    throw new Error('radix2.decode input should be array of numbers');
                return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
            },
        };
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function unsafeWrapper(fn) {
        if (typeof fn !== 'function')
            throw new Error('unsafeWrapper fn should be function');
        return function (...args) {
            try {
                return fn.apply(null, args);
            }
            catch (e) { }
        };
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function checksum(len, fn) {
        if (typeof fn !== 'function')
            throw new Error('checksum fn should be function');
        return {
            encode(data) {
                if (!isBytes(data))
                    throw new Error('checksum.encode: input should be Uint8Array');
                const checksum = fn(data).slice(0, len);
                const res = new Uint8Array(data.length + len);
                res.set(data);
                res.set(checksum, data.length);
                return res;
            },
            decode(data) {
                if (!isBytes(data))
                    throw new Error('checksum.decode: input should be Uint8Array');
                const payload = data.slice(0, -len);
                const newChecksum = fn(payload).slice(0, len);
                const oldChecksum = data.slice(-len);
                for (let i = 0; i < len; i++)
                    if (newChecksum[i] !== oldChecksum[i])
                        throw new Error('Invalid checksum');
                return payload;
            },
        };
    }
    // prettier-ignore
    const utils$2 = {
        alphabet, chain, checksum, convertRadix, convertRadix2, radix, radix2, join, padding,
    };
    // base58 code
    // -----------
    const genBase58 = (abc) => chain(radix(58), alphabet(abc), join(''));
    const base58 = /* @__PURE__ */ genBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
    const createBase58check =  (sha256) => chain(checksum(4, (data) => sha256(sha256(data))), base58);
    // legacy export, bad name
    const base58check$1 = createBase58check;
    const BECH_ALPHABET = /* @__PURE__ */ chain(alphabet('qpzry9x8gf2tvdw0s3jn54khce6mua7l'), join(''));
    const POLYMOD_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function bech32Polymod(pre) {
        const b = pre >> 25;
        let chk = (pre & 0x1ffffff) << 5;
        for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
            if (((b >> i) & 1) === 1)
                chk ^= POLYMOD_GENERATORS[i];
        }
        return chk;
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function bechChecksum(prefix, words, encodingConst = 1) {
        const len = prefix.length;
        let chk = 1;
        for (let i = 0; i < len; i++) {
            const c = prefix.charCodeAt(i);
            if (c < 33 || c > 126)
                throw new Error(`Invalid prefix (${prefix})`);
            chk = bech32Polymod(chk) ^ (c >> 5);
        }
        chk = bech32Polymod(chk);
        for (let i = 0; i < len; i++)
            chk = bech32Polymod(chk) ^ (prefix.charCodeAt(i) & 0x1f);
        for (let v of words)
            chk = bech32Polymod(chk) ^ v;
        for (let i = 0; i < 6; i++)
            chk = bech32Polymod(chk);
        chk ^= encodingConst;
        return BECH_ALPHABET.encode(convertRadix2([chk % 2 ** 30], 30, 5, false));
    }
    /**
     * @__NO_SIDE_EFFECTS__
     */
    function genBech32(encoding) {
        const ENCODING_CONST = encoding === 'bech32' ? 1 : 0x2bc830a3;
        const _words = radix2(5);
        const fromWords = _words.decode;
        const toWords = _words.encode;
        const fromWordsUnsafe = unsafeWrapper(fromWords);
        function encode(prefix, words, limit = 90) {
            if (typeof prefix !== 'string')
                throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
            if (!Array.isArray(words) || (words.length && typeof words[0] !== 'number'))
                throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
            const actualLength = prefix.length + 7 + words.length;
            if (limit !== false && actualLength > limit)
                throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
            const lowered = prefix.toLowerCase();
            const sum = bechChecksum(lowered, words, ENCODING_CONST);
            return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
        }
        function decode(str, limit = 90) {
            if (typeof str !== 'string')
                throw new Error(`bech32.decode input should be string, not ${typeof str}`);
            if (str.length < 8 || (limit !== false && str.length > limit))
                throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
            // don't allow mixed case
            const lowered = str.toLowerCase();
            if (str !== lowered && str !== str.toUpperCase())
                throw new Error(`String must be lowercase or uppercase`);
            str = lowered;
            const sepIndex = str.lastIndexOf('1');
            if (sepIndex === 0 || sepIndex === -1)
                throw new Error(`Letter "1" must be present between prefix and data only`);
            const prefix = str.slice(0, sepIndex);
            const _words = str.slice(sepIndex + 1);
            if (_words.length < 6)
                throw new Error('Data must be at least 6 characters long');
            const words = BECH_ALPHABET.decode(_words).slice(0, -6);
            const sum = bechChecksum(prefix, words, ENCODING_CONST);
            if (!_words.endsWith(sum))
                throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
            return { prefix, words };
        }
        const decodeUnsafe = unsafeWrapper(decode);
        function decodeToBytes(str) {
            const { prefix, words } = decode(str, false);
            return { prefix, words, bytes: fromWords(words) };
        }
        return { encode, decode, decodeToBytes, decodeUnsafe, fromWords, fromWordsUnsafe, toWords };
    }
    const bech32 = /* @__PURE__ */ genBech32('bech32');

    const isJapanese = (wordlist) => wordlist[0] === '\u3042\u3044\u3053\u304f\u3057\u3093';
    function nfkd(str) {
        if (typeof str !== 'string')
            throw new TypeError(`Invalid mnemonic type: ${typeof str}`);
        return str.normalize('NFKD');
    }
    function normalize(str) {
        const norm = nfkd(str);
        const words = norm.split(' ');
        if (![12, 15, 18, 21, 24].includes(words.length))
            throw new Error('Invalid mnemonic');
        return { nfkd: norm, words };
    }
    function assertEntropy(entropy) {
        assert$1.bytes(entropy, 16, 20, 24, 28, 32);
    }
    function generateMnemonic(wordlist, strength = 128) {
        assert$1.number(strength);
        if (strength % 32 !== 0 || strength > 256)
            throw new TypeError('Invalid entropy');
        return entropyToMnemonic(randomBytes(strength / 8), wordlist);
    }
    const calcChecksum = (entropy) => {
        const bitsLeft = 8 - entropy.length / 4;
        return new Uint8Array([(sha256(entropy)[0] >> bitsLeft) << bitsLeft]);
    };
    function getCoder(wordlist) {
        if (!Array.isArray(wordlist) || wordlist.length !== 2048 || typeof wordlist[0] !== 'string')
            throw new Error('Worlist: expected array of 2048 strings');
        wordlist.forEach((i) => {
            if (typeof i !== 'string')
                throw new Error(`Wordlist: non-string element: ${i}`);
        });
        return utils$2.chain(utils$2.checksum(1, calcChecksum), utils$2.radix2(11, true), utils$2.alphabet(wordlist));
    }
    function mnemonicToEntropy(mnemonic, wordlist) {
        const { words } = normalize(mnemonic);
        const entropy = getCoder(wordlist).decode(words);
        assertEntropy(entropy);
        return entropy;
    }
    function entropyToMnemonic(entropy, wordlist) {
        assertEntropy(entropy);
        const words = getCoder(wordlist).encode(entropy);
        return words.join(isJapanese(wordlist) ? '\u3000' : ' ');
    }
    function validateMnemonic(mnemonic, wordlist) {
        try {
            mnemonicToEntropy(mnemonic, wordlist);
        }
        catch (e) {
            return false;
        }
        return true;
    }
    const salt = (passphrase) => nfkd(`mnemonic${passphrase}`);
    function mnemonicToSeedSync(mnemonic, passphrase = '') {
        return pbkdf2(sha512, normalize(mnemonic).nfkd, salt(passphrase), { c: 2048, dkLen: 64 });
    }

    // https://homes.esat.kuleuven.be/~bosselae/ripemd160.html
    // https://homes.esat.kuleuven.be/~bosselae/ripemd160/pdf/AB-9601/AB-9601.pdf
    const Rho = /* @__PURE__ */ new Uint8Array([7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8]);
    const Id = /* @__PURE__ */ Uint8Array.from({ length: 16 }, (_, i) => i);
    const Pi = /* @__PURE__ */ Id.map((i) => (9 * i + 5) % 16);
    let idxL = [Id];
    let idxR = [Pi];
    for (let i = 0; i < 4; i++)
        for (let j of [idxL, idxR])
            j.push(j[i].map((k) => Rho[k]));
    const shifts = /* @__PURE__ */ [
        [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
        [12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7],
        [13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9],
        [14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6],
        [15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5],
    ].map((i) => new Uint8Array(i));
    const shiftsL = /* @__PURE__ */ idxL.map((idx, i) => idx.map((j) => shifts[i][j]));
    const shiftsR = /* @__PURE__ */ idxR.map((idx, i) => idx.map((j) => shifts[i][j]));
    const Kl = /* @__PURE__ */ new Uint32Array([
        0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e,
    ]);
    const Kr = /* @__PURE__ */ new Uint32Array([
        0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000,
    ]);
    // The rotate left (circular left shift) operation for uint32
    const rotl$1 = (word, shift) => (word << shift) | (word >>> (32 - shift));
    // It's called f() in spec.
    function f(group, x, y, z) {
        if (group === 0)
            return x ^ y ^ z;
        else if (group === 1)
            return (x & y) | (~x & z);
        else if (group === 2)
            return (x | ~y) ^ z;
        else if (group === 3)
            return (x & z) | (y & ~z);
        else
            return x ^ (y | ~z);
    }
    // Temporary buffer, not used to store anything between runs
    const BUF = /* @__PURE__ */ new Uint32Array(16);
    class RIPEMD160 extends SHA2 {
        constructor() {
            super(64, 20, 8, true);
            this.h0 = 0x67452301 | 0;
            this.h1 = 0xefcdab89 | 0;
            this.h2 = 0x98badcfe | 0;
            this.h3 = 0x10325476 | 0;
            this.h4 = 0xc3d2e1f0 | 0;
        }
        get() {
            const { h0, h1, h2, h3, h4 } = this;
            return [h0, h1, h2, h3, h4];
        }
        set(h0, h1, h2, h3, h4) {
            this.h0 = h0 | 0;
            this.h1 = h1 | 0;
            this.h2 = h2 | 0;
            this.h3 = h3 | 0;
            this.h4 = h4 | 0;
        }
        process(view, offset) {
            for (let i = 0; i < 16; i++, offset += 4)
                BUF[i] = view.getUint32(offset, true);
            // prettier-ignore
            let al = this.h0 | 0, ar = al, bl = this.h1 | 0, br = bl, cl = this.h2 | 0, cr = cl, dl = this.h3 | 0, dr = dl, el = this.h4 | 0, er = el;
            // Instead of iterating 0 to 80, we split it into 5 groups
            // And use the groups in constants, functions, etc. Much simpler
            for (let group = 0; group < 5; group++) {
                const rGroup = 4 - group;
                const hbl = Kl[group], hbr = Kr[group]; // prettier-ignore
                const rl = idxL[group], rr = idxR[group]; // prettier-ignore
                const sl = shiftsL[group], sr = shiftsR[group]; // prettier-ignore
                for (let i = 0; i < 16; i++) {
                    const tl = (rotl$1(al + f(group, bl, cl, dl) + BUF[rl[i]] + hbl, sl[i]) + el) | 0;
                    al = el, el = dl, dl = rotl$1(cl, 10) | 0, cl = bl, bl = tl; // prettier-ignore
                }
                // 2 loops are 10% faster
                for (let i = 0; i < 16; i++) {
                    const tr = (rotl$1(ar + f(rGroup, br, cr, dr) + BUF[rr[i]] + hbr, sr[i]) + er) | 0;
                    ar = er, er = dr, dr = rotl$1(cr, 10) | 0, cr = br, br = tr; // prettier-ignore
                }
            }
            // Add the compressed chunk to the current hash value
            this.set((this.h1 + cl + dr) | 0, (this.h2 + dl + er) | 0, (this.h3 + el + ar) | 0, (this.h4 + al + br) | 0, (this.h0 + bl + cr) | 0);
        }
        roundClean() {
            BUF.fill(0);
        }
        destroy() {
            this.destroyed = true;
            this.buffer.fill(0);
            this.set(0, 0, 0, 0, 0);
        }
    }
    /**
     * RIPEMD-160 - a hash function from 1990s.
     * @param message - msg that would be hashed
     */
    const ripemd160 = /* @__PURE__ */ wrapConstructor(() => new RIPEMD160());

    const Point = secp256k1.ProjectivePoint;
    const base58check = base58check$1(sha256);
    function bytesToNumber(bytes) {
        return BigInt(`0x${bytesToHex(bytes)}`);
    }
    function numberToBytes(num) {
        return hexToBytes(num.toString(16).padStart(64, '0'));
    }
    const MASTER_SECRET = utf8ToBytes$1('Bitcoin seed');
    const BITCOIN_VERSIONS = { private: 0x0488ade4, public: 0x0488b21e };
    const HARDENED_OFFSET = 0x80000000;
    const hash160 = (data) => ripemd160(sha256(data));
    const fromU32 = (data) => createView(data).getUint32(0, false);
    const toU32 = (n) => {
        if (!Number.isSafeInteger(n) || n < 0 || n > 2 ** 32 - 1) {
            throw new Error(`Invalid number=${n}. Should be from 0 to 2 ** 32 - 1`);
        }
        const buf = new Uint8Array(4);
        createView(buf).setUint32(0, n, false);
        return buf;
    };
    class HDKey {
        get fingerprint() {
            if (!this.pubHash) {
                throw new Error('No publicKey set!');
            }
            return fromU32(this.pubHash);
        }
        get identifier() {
            return this.pubHash;
        }
        get pubKeyHash() {
            return this.pubHash;
        }
        get privateKey() {
            return this.privKeyBytes || null;
        }
        get publicKey() {
            return this.pubKey || null;
        }
        get privateExtendedKey() {
            const priv = this.privateKey;
            if (!priv) {
                throw new Error('No private key');
            }
            return base58check.encode(this.serialize(this.versions.private, concatBytes(new Uint8Array([0]), priv)));
        }
        get publicExtendedKey() {
            if (!this.pubKey) {
                throw new Error('No public key');
            }
            return base58check.encode(this.serialize(this.versions.public, this.pubKey));
        }
        static fromMasterSeed(seed, versions = BITCOIN_VERSIONS) {
            bytes$1(seed);
            if (8 * seed.length < 128 || 8 * seed.length > 512) {
                throw new Error(`HDKey: wrong seed length=${seed.length}. Should be between 128 and 512 bits; 256 bits is advised)`);
            }
            const I = hmac$1(sha512, MASTER_SECRET, seed);
            return new HDKey({
                versions,
                chainCode: I.slice(32),
                privateKey: I.slice(0, 32),
            });
        }
        static fromExtendedKey(base58key, versions = BITCOIN_VERSIONS) {
            const keyBuffer = base58check.decode(base58key);
            const keyView = createView(keyBuffer);
            const version = keyView.getUint32(0, false);
            const opt = {
                versions,
                depth: keyBuffer[4],
                parentFingerprint: keyView.getUint32(5, false),
                index: keyView.getUint32(9, false),
                chainCode: keyBuffer.slice(13, 45),
            };
            const key = keyBuffer.slice(45);
            const isPriv = key[0] === 0;
            if (version !== versions[isPriv ? 'private' : 'public']) {
                throw new Error('Version mismatch');
            }
            if (isPriv) {
                return new HDKey({ ...opt, privateKey: key.slice(1) });
            }
            else {
                return new HDKey({ ...opt, publicKey: key });
            }
        }
        static fromJSON(json) {
            return HDKey.fromExtendedKey(json.xpriv);
        }
        constructor(opt) {
            this.depth = 0;
            this.index = 0;
            this.chainCode = null;
            this.parentFingerprint = 0;
            if (!opt || typeof opt !== 'object') {
                throw new Error('HDKey.constructor must not be called directly');
            }
            this.versions = opt.versions || BITCOIN_VERSIONS;
            this.depth = opt.depth || 0;
            this.chainCode = opt.chainCode;
            this.index = opt.index || 0;
            this.parentFingerprint = opt.parentFingerprint || 0;
            if (!this.depth) {
                if (this.parentFingerprint || this.index) {
                    throw new Error('HDKey: zero depth with non-zero index/parent fingerprint');
                }
            }
            if (opt.publicKey && opt.privateKey) {
                throw new Error('HDKey: publicKey and privateKey at same time.');
            }
            if (opt.privateKey) {
                if (!secp256k1.utils.isValidPrivateKey(opt.privateKey)) {
                    throw new Error('Invalid private key');
                }
                this.privKey =
                    typeof opt.privateKey === 'bigint' ? opt.privateKey : bytesToNumber(opt.privateKey);
                this.privKeyBytes = numberToBytes(this.privKey);
                this.pubKey = secp256k1.getPublicKey(opt.privateKey, true);
            }
            else if (opt.publicKey) {
                this.pubKey = Point.fromHex(opt.publicKey).toRawBytes(true);
            }
            else {
                throw new Error('HDKey: no public or private key provided');
            }
            this.pubHash = hash160(this.pubKey);
        }
        derive(path) {
            if (!/^[mM]'?/.test(path)) {
                throw new Error('Path must start with "m" or "M"');
            }
            if (/^[mM]'?$/.test(path)) {
                return this;
            }
            const parts = path.replace(/^[mM]'?\//, '').split('/');
            let child = this;
            for (const c of parts) {
                const m = /^(\d+)('?)$/.exec(c);
                if (!m || m.length !== 3) {
                    throw new Error(`Invalid child index: ${c}`);
                }
                let idx = +m[1];
                if (!Number.isSafeInteger(idx) || idx >= HARDENED_OFFSET) {
                    throw new Error('Invalid index');
                }
                if (m[2] === "'") {
                    idx += HARDENED_OFFSET;
                }
                child = child.deriveChild(idx);
            }
            return child;
        }
        deriveChild(index) {
            if (!this.pubKey || !this.chainCode) {
                throw new Error('No publicKey or chainCode set');
            }
            let data = toU32(index);
            if (index >= HARDENED_OFFSET) {
                const priv = this.privateKey;
                if (!priv) {
                    throw new Error('Could not derive hardened child key');
                }
                data = concatBytes(new Uint8Array([0]), priv, data);
            }
            else {
                data = concatBytes(this.pubKey, data);
            }
            const I = hmac$1(sha512, this.chainCode, data);
            const childTweak = bytesToNumber(I.slice(0, 32));
            const chainCode = I.slice(32);
            if (!secp256k1.utils.isValidPrivateKey(childTweak)) {
                throw new Error('Tweak bigger than curve order');
            }
            const opt = {
                versions: this.versions,
                chainCode,
                depth: this.depth + 1,
                parentFingerprint: this.fingerprint,
                index,
            };
            try {
                if (this.privateKey) {
                    const added = mod(this.privKey + childTweak, secp256k1.CURVE.n);
                    if (!secp256k1.utils.isValidPrivateKey(added)) {
                        throw new Error('The tweak was out of range or the resulted private key is invalid');
                    }
                    opt.privateKey = added;
                }
                else {
                    const added = Point.fromHex(this.pubKey).add(Point.fromPrivateKey(childTweak));
                    if (added.equals(Point.ZERO)) {
                        throw new Error('The tweak was equal to negative P, which made the result key invalid');
                    }
                    opt.publicKey = added.toRawBytes(true);
                }
                return new HDKey(opt);
            }
            catch (err) {
                return this.deriveChild(index + 1);
            }
        }
        sign(hash) {
            if (!this.privateKey) {
                throw new Error('No privateKey set!');
            }
            bytes$1(hash, 32);
            return secp256k1.sign(hash, this.privKey).toCompactRawBytes();
        }
        verify(hash, signature) {
            bytes$1(hash, 32);
            bytes$1(signature, 64);
            if (!this.publicKey) {
                throw new Error('No publicKey set!');
            }
            let sig;
            try {
                sig = secp256k1.Signature.fromCompact(signature);
            }
            catch (error) {
                return false;
            }
            return secp256k1.verify(sig, hash, this.publicKey);
        }
        wipePrivateData() {
            this.privKey = undefined;
            if (this.privKeyBytes) {
                this.privKeyBytes.fill(0);
                this.privKeyBytes = undefined;
            }
            return this;
        }
        toJSON() {
            return {
                xpriv: this.privateExtendedKey,
                xpub: this.publicExtendedKey,
            };
        }
        serialize(version, key) {
            if (!this.chainCode) {
                throw new Error('No chainCode set');
            }
            bytes$1(key, 33);
            return concatBytes(toU32(version), new Uint8Array([this.depth]), toU32(this.parentFingerprint), toU32(this.index), this.chainCode, key);
        }
    }

    /*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
    const u8a = (a) => a instanceof Uint8Array;
    const u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
    // big-endian hardware is rare. Just in case someone still decides to run ciphers:
    // early-throw an error because we don't support BE yet.
    const isLE = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
    if (!isLE)
        throw new Error('Non little-endian hardware is not supported');
    /**
     * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
     */
    function utf8ToBytes(str) {
        if (typeof str !== 'string')
            throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
        return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
    }
    /**
     * Normalizes (non-hex) string or Uint8Array to Uint8Array.
     * Warning: when Uint8Array is passed, it would NOT get copied.
     * Keep in mind for future mutable operations.
     */
    function toBytes(data) {
        if (typeof data === 'string')
            data = utf8ToBytes(data);
        if (!u8a(data))
            throw new Error(`expected Uint8Array, got ${typeof data}`);
        return data;
    }
    // Check if object doens't have custom constructor (like Uint8Array/Array)
    const isPlainObject = (obj) => Object.prototype.toString.call(obj) === '[object Object]' && obj.constructor === Object;
    function checkOpts(defaults, opts) {
        if (opts !== undefined && (typeof opts !== 'object' || !isPlainObject(opts)))
            throw new Error('options must be object or undefined');
        const merged = Object.assign(defaults, opts);
        return merged;
    }
    function ensureBytes(b, len) {
        if (!(b instanceof Uint8Array))
            throw new Error('Uint8Array expected');
        if (typeof len === 'number')
            if (b.length !== len)
                throw new Error(`Uint8Array length ${len} expected`);
    }
    // Constant-time equality
    function equalBytes(a, b) {
        // Should not happen
        if (a.length !== b.length)
            throw new Error('equalBytes: Different size of Uint8Arrays');
        let isSame = true;
        for (let i = 0; i < a.length; i++)
            isSame && (isSame = a[i] === b[i]); // Lets hope JIT won't optimize away.
        return isSame;
    }

    function number(n) {
        if (!Number.isSafeInteger(n) || n < 0)
            throw new Error(`Wrong positive integer: ${n}`);
    }
    function bool(b) {
        if (typeof b !== 'boolean')
            throw new Error(`Expected boolean, not ${b}`);
    }
    function bytes(b, ...lengths) {
        if (!(b instanceof Uint8Array))
            throw new Error('Expected Uint8Array');
        if (lengths.length > 0 && !lengths.includes(b.length))
            throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
    }
    function hash(hash) {
        if (typeof hash !== 'function' || typeof hash.create !== 'function')
            throw new Error('hash must be wrapped by utils.wrapConstructor');
        number(hash.outputLen);
        number(hash.blockLen);
    }
    function exists(instance, checkFinished = true) {
        if (instance.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (checkFinished && instance.finished)
            throw new Error('Hash#digest() has already been called');
    }
    function output(out, instance) {
        bytes(out);
        const min = instance.outputLen;
        if (out.length < min) {
            throw new Error(`digestInto() expects output buffer of length at least ${min}`);
        }
    }
    const assert = { number, bool, bytes, hash, exists, output };

    // Poly1305 is a fast and parallel secret-key message-authentication code.
    // https://cr.yp.to/mac.html, https://cr.yp.to/mac/poly1305-20050329.pdf
    // https://datatracker.ietf.org/doc/html/rfc8439
    // Based on Public Domain poly1305-donna https://github.com/floodyberry/poly1305-donna
    const u8to16 = (a, i) => (a[i++] & 0xff) | ((a[i++] & 0xff) << 8);
    class Poly1305 {
        constructor(key) {
            this.blockLen = 16;
            this.outputLen = 16;
            this.buffer = new Uint8Array(16);
            this.r = new Uint16Array(10);
            this.h = new Uint16Array(10);
            this.pad = new Uint16Array(8);
            this.pos = 0;
            this.finished = false;
            key = toBytes(key);
            ensureBytes(key, 32);
            const t0 = u8to16(key, 0);
            const t1 = u8to16(key, 2);
            const t2 = u8to16(key, 4);
            const t3 = u8to16(key, 6);
            const t4 = u8to16(key, 8);
            const t5 = u8to16(key, 10);
            const t6 = u8to16(key, 12);
            const t7 = u8to16(key, 14);
            // https://github.com/floodyberry/poly1305-donna/blob/e6ad6e091d30d7f4ec2d4f978be1fcfcbce72781/poly1305-donna-16.h#L47
            this.r[0] = t0 & 0x1fff;
            this.r[1] = ((t0 >>> 13) | (t1 << 3)) & 0x1fff;
            this.r[2] = ((t1 >>> 10) | (t2 << 6)) & 0x1f03;
            this.r[3] = ((t2 >>> 7) | (t3 << 9)) & 0x1fff;
            this.r[4] = ((t3 >>> 4) | (t4 << 12)) & 0x00ff;
            this.r[5] = (t4 >>> 1) & 0x1ffe;
            this.r[6] = ((t4 >>> 14) | (t5 << 2)) & 0x1fff;
            this.r[7] = ((t5 >>> 11) | (t6 << 5)) & 0x1f81;
            this.r[8] = ((t6 >>> 8) | (t7 << 8)) & 0x1fff;
            this.r[9] = (t7 >>> 5) & 0x007f;
            for (let i = 0; i < 8; i++)
                this.pad[i] = u8to16(key, 16 + 2 * i);
        }
        process(data, offset, isLast = false) {
            const hibit = isLast ? 0 : 1 << 11;
            const { h, r } = this;
            const r0 = r[0];
            const r1 = r[1];
            const r2 = r[2];
            const r3 = r[3];
            const r4 = r[4];
            const r5 = r[5];
            const r6 = r[6];
            const r7 = r[7];
            const r8 = r[8];
            const r9 = r[9];
            const t0 = u8to16(data, offset + 0);
            const t1 = u8to16(data, offset + 2);
            const t2 = u8to16(data, offset + 4);
            const t3 = u8to16(data, offset + 6);
            const t4 = u8to16(data, offset + 8);
            const t5 = u8to16(data, offset + 10);
            const t6 = u8to16(data, offset + 12);
            const t7 = u8to16(data, offset + 14);
            let h0 = h[0] + (t0 & 0x1fff);
            let h1 = h[1] + (((t0 >>> 13) | (t1 << 3)) & 0x1fff);
            let h2 = h[2] + (((t1 >>> 10) | (t2 << 6)) & 0x1fff);
            let h3 = h[3] + (((t2 >>> 7) | (t3 << 9)) & 0x1fff);
            let h4 = h[4] + (((t3 >>> 4) | (t4 << 12)) & 0x1fff);
            let h5 = h[5] + ((t4 >>> 1) & 0x1fff);
            let h6 = h[6] + (((t4 >>> 14) | (t5 << 2)) & 0x1fff);
            let h7 = h[7] + (((t5 >>> 11) | (t6 << 5)) & 0x1fff);
            let h8 = h[8] + (((t6 >>> 8) | (t7 << 8)) & 0x1fff);
            let h9 = h[9] + ((t7 >>> 5) | hibit);
            let c = 0;
            let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
            c = d0 >>> 13;
            d0 &= 0x1fff;
            d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
            c += d0 >>> 13;
            d0 &= 0x1fff;
            let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
            c = d1 >>> 13;
            d1 &= 0x1fff;
            d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
            c += d1 >>> 13;
            d1 &= 0x1fff;
            let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
            c = d2 >>> 13;
            d2 &= 0x1fff;
            d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
            c += d2 >>> 13;
            d2 &= 0x1fff;
            let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
            c = d3 >>> 13;
            d3 &= 0x1fff;
            d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
            c += d3 >>> 13;
            d3 &= 0x1fff;
            let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
            c = d4 >>> 13;
            d4 &= 0x1fff;
            d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
            c += d4 >>> 13;
            d4 &= 0x1fff;
            let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
            c = d5 >>> 13;
            d5 &= 0x1fff;
            d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
            c += d5 >>> 13;
            d5 &= 0x1fff;
            let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
            c = d6 >>> 13;
            d6 &= 0x1fff;
            d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
            c += d6 >>> 13;
            d6 &= 0x1fff;
            let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
            c = d7 >>> 13;
            d7 &= 0x1fff;
            d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
            c += d7 >>> 13;
            d7 &= 0x1fff;
            let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
            c = d8 >>> 13;
            d8 &= 0x1fff;
            d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
            c += d8 >>> 13;
            d8 &= 0x1fff;
            let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
            c = d9 >>> 13;
            d9 &= 0x1fff;
            d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
            c += d9 >>> 13;
            d9 &= 0x1fff;
            c = ((c << 2) + c) | 0;
            c = (c + d0) | 0;
            d0 = c & 0x1fff;
            c = c >>> 13;
            d1 += c;
            h[0] = d0;
            h[1] = d1;
            h[2] = d2;
            h[3] = d3;
            h[4] = d4;
            h[5] = d5;
            h[6] = d6;
            h[7] = d7;
            h[8] = d8;
            h[9] = d9;
        }
        finalize() {
            const { h, pad } = this;
            const g = new Uint16Array(10);
            let c = h[1] >>> 13;
            h[1] &= 0x1fff;
            for (let i = 2; i < 10; i++) {
                h[i] += c;
                c = h[i] >>> 13;
                h[i] &= 0x1fff;
            }
            h[0] += c * 5;
            c = h[0] >>> 13;
            h[0] &= 0x1fff;
            h[1] += c;
            c = h[1] >>> 13;
            h[1] &= 0x1fff;
            h[2] += c;
            g[0] = h[0] + 5;
            c = g[0] >>> 13;
            g[0] &= 0x1fff;
            for (let i = 1; i < 10; i++) {
                g[i] = h[i] + c;
                c = g[i] >>> 13;
                g[i] &= 0x1fff;
            }
            g[9] -= 1 << 13;
            let mask = (c ^ 1) - 1;
            for (let i = 0; i < 10; i++)
                g[i] &= mask;
            mask = ~mask;
            for (let i = 0; i < 10; i++)
                h[i] = (h[i] & mask) | g[i];
            h[0] = (h[0] | (h[1] << 13)) & 0xffff;
            h[1] = ((h[1] >>> 3) | (h[2] << 10)) & 0xffff;
            h[2] = ((h[2] >>> 6) | (h[3] << 7)) & 0xffff;
            h[3] = ((h[3] >>> 9) | (h[4] << 4)) & 0xffff;
            h[4] = ((h[4] >>> 12) | (h[5] << 1) | (h[6] << 14)) & 0xffff;
            h[5] = ((h[6] >>> 2) | (h[7] << 11)) & 0xffff;
            h[6] = ((h[7] >>> 5) | (h[8] << 8)) & 0xffff;
            h[7] = ((h[8] >>> 8) | (h[9] << 5)) & 0xffff;
            let f = h[0] + pad[0];
            h[0] = f & 0xffff;
            for (let i = 1; i < 8; i++) {
                f = (((h[i] + pad[i]) | 0) + (f >>> 16)) | 0;
                h[i] = f & 0xffff;
            }
        }
        update(data) {
            assert.exists(this);
            const { buffer, blockLen } = this;
            data = toBytes(data);
            const len = data.length;
            for (let pos = 0; pos < len;) {
                const take = Math.min(blockLen - this.pos, len - pos);
                // Fast path: we have at least one block in input
                if (take === blockLen) {
                    for (; blockLen <= len - pos; pos += blockLen)
                        this.process(data, pos);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                pos += take;
                if (this.pos === blockLen) {
                    this.process(buffer, 0, false);
                    this.pos = 0;
                }
            }
            return this;
        }
        destroy() {
            this.h.fill(0);
            this.r.fill(0);
            this.buffer.fill(0);
            this.pad.fill(0);
        }
        digestInto(out) {
            assert.exists(this);
            assert.output(out, this);
            this.finished = true;
            const { buffer, h } = this;
            let { pos } = this;
            if (pos) {
                buffer[pos++] = 1;
                // buffer.subarray(pos).fill(0);
                for (; pos < 16; pos++)
                    buffer[pos] = 0;
                this.process(buffer, 0, true);
            }
            this.finalize();
            let opos = 0;
            for (let i = 0; i < 8; i++) {
                out[opos++] = h[i] >>> 0;
                out[opos++] = h[i] >>> 8;
            }
            return out;
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
    }
    function wrapConstructorWithKey(hashCons) {
        const hashC = (msg, key) => hashCons(key).update(toBytes(msg)).digest();
        const tmp = hashCons(new Uint8Array(32));
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = (key) => hashCons(key);
        return hashC;
    }
    wrapConstructorWithKey((key) => new Poly1305(key));

    // Basic utils for salsa-like ciphers
    // Check out _micro.ts for descriptive documentation.
    /*
    RFC8439 requires multi-step cipher stream, where
    authKey starts with counter: 0, actual msg with counter: 1.

    For this, we need a way to re-use nonce / counter:

        const counter = new Uint8Array(4);
        chacha(..., counter, ...); // counter is now 1
        chacha(..., counter, ...); // counter is now 2

    This is complicated:

    - Original papers don't allow mutating counters
    - Counter overflow is undefined: https://mailarchive.ietf.org/arch/msg/cfrg/gsOnTJzcbgG6OqD8Sc0GO5aR_tU/
    - 3rd-party library stablelib implementation uses an approach where you can provide
      nonce and counter instead of just nonce - and it will re-use it
    - We could have did something similar, but ChaCha has different counter position
      (counter | nonce), which is not composable with XChaCha, because full counter
      is (nonce16 | counter | nonce16). Stablelib doesn't support in-place counter for XChaCha.
    - We could separate nonce & counter and provide separate API for counter re-use, but
      there are different counter sizes depending on an algorithm.
    - Salsa & ChaCha also differ in structures of key / sigma:

        salsa:     c0 | k(4) | c1 | nonce(2) | ctr(2) | c2 | k(4) | c4
        chacha:    c(4) | k(8) | ctr(1) | nonce(3)
        chachaDJB: c(4) | k(8) | ctr(2) | nonce(2)
    - Creating function such as `setSalsaState(key, nonce, sigma, data)` won't work,
      because we can't re-use counter array
    - 32-bit nonce is `2 ** 32 * 64` = 256GB with 32-bit counter
    - JS does not allow UintArrays bigger than 4GB, so supporting 64-bit counters doesn't matter

    Structure is as following:

    key=16 -> sigma16, k=key|key
    key=32 -> sigma32, k=key

    nonces:
    salsa20:      8   (8-byte counter)
    chacha20djb:  8   (8-byte counter)
    chacha20tls:  12  (4-byte counter)
    xsalsa:       24  (16 -> hsalsa, 8 -> old nonce)
    xchacha:      24  (16 -> hchacha, 8 -> old nonce)

    https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha#appendix-A.2
    Use the subkey and remaining 8 byte nonce with ChaCha20 as normal
    (prefixed by 4 NUL bytes, since [RFC8439] specifies a 12-byte nonce).
    */
    const sigma16 = utf8ToBytes('expand 16-byte k');
    const sigma32 = utf8ToBytes('expand 32-byte k');
    const sigma16_32 = u32(sigma16);
    const sigma32_32 = u32(sigma32);
    // Is byte array aligned to 4 byte offset (u32)?
    const isAligned32 = (b) => !(b.byteOffset % 4);
    const salsaBasic = (opts) => {
        const { core, rounds, counterRight, counterLen, allow128bitKeys, extendNonceFn, blockLen } = checkOpts({ rounds: 20, counterRight: false, counterLen: 8, allow128bitKeys: true, blockLen: 64 }, opts);
        assert.number(counterLen);
        assert.number(rounds);
        assert.number(blockLen);
        assert.bool(counterRight);
        assert.bool(allow128bitKeys);
        const blockLen32 = blockLen / 4;
        if (blockLen % 4 !== 0)
            throw new Error('Salsa/ChaCha: blockLen must be aligned to 4 bytes');
        return (key, nonce, data, output, counter = 0) => {
            assert.bytes(key);
            assert.bytes(nonce);
            assert.bytes(data);
            if (!output)
                output = new Uint8Array(data.length);
            assert.bytes(output);
            assert.number(counter);
            // > new Uint32Array([2**32])
            // Uint32Array(1) [ 0 ]
            // > new Uint32Array([2**32-1])
            // Uint32Array(1) [ 4294967295 ]
            if (counter < 0 || counter >= 2 ** 32 - 1)
                throw new Error('Salsa/ChaCha: counter overflow');
            if (output.length < data.length) {
                throw new Error(`Salsa/ChaCha: output (${output.length}) is shorter than data (${data.length})`);
            }
            const toClean = [];
            let k, sigma;
            // Handle 128 byte keys
            if (key.length === 32) {
                k = key;
                sigma = sigma32_32;
            }
            else if (key.length === 16 && allow128bitKeys) {
                k = new Uint8Array(32);
                k.set(key);
                k.set(key, 16);
                sigma = sigma16_32;
                toClean.push(k);
            }
            else
                throw new Error(`Salsa/ChaCha: invalid 32-byte key, got length=${key.length}`);
            // Handle extended nonce (HChaCha/HSalsa)
            if (extendNonceFn) {
                if (nonce.length <= 16)
                    throw new Error(`Salsa/ChaCha: extended nonce must be bigger than 16 bytes`);
                k = extendNonceFn(sigma, k, nonce.subarray(0, 16), new Uint8Array(32));
                toClean.push(k);
                nonce = nonce.subarray(16);
            }
            // Handle nonce counter
            const nonceLen = 16 - counterLen;
            if (nonce.length !== nonceLen)
                throw new Error(`Salsa/ChaCha: nonce must be ${nonceLen} or 16 bytes`);
            // Pad counter when nonce is 64 bit
            if (nonceLen !== 12) {
                const nc = new Uint8Array(12);
                nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
                toClean.push((nonce = nc));
            }
            // Counter positions
            const block = new Uint8Array(blockLen);
            // Cast to Uint32Array for speed
            const b32 = u32(block);
            const k32 = u32(k);
            const n32 = u32(nonce);
            // Make sure that buffers aligned to 4 bytes
            const d32 = isAligned32(data) && u32(data);
            const o32 = isAligned32(output) && u32(output);
            toClean.push(b32);
            const len = data.length;
            for (let pos = 0, ctr = counter; pos < len; ctr++) {
                core(sigma, k32, n32, b32, ctr, rounds);
                if (ctr >= 2 ** 32 - 1)
                    throw new Error('Salsa/ChaCha: counter overflow');
                const take = Math.min(blockLen, len - pos);
                // full block && aligned to 4 bytes
                if (take === blockLen && o32 && d32) {
                    const pos32 = pos / 4;
                    if (pos % 4 !== 0)
                        throw new Error('Salsa/ChaCha: invalid block position');
                    for (let j = 0; j < blockLen32; j++)
                        o32[pos32 + j] = d32[pos32 + j] ^ b32[j];
                    pos += blockLen;
                    continue;
                }
                for (let j = 0; j < take; j++)
                    output[pos + j] = data[pos + j] ^ block[j];
                pos += take;
            }
            for (let i = 0; i < toClean.length; i++)
                toClean[i].fill(0);
            return output;
        };
    };

    // ChaCha20 stream cipher was released in 2008. ChaCha aims to increase
    // the diffusion per round, but had slightly less cryptanalysis.
    // https://cr.yp.to/chacha.html, http://cr.yp.to/chacha/chacha-20080128.pdf
    // Left rotate for uint32
    const rotl = (a, b) => (a << b) | (a >>> (32 - b));
    /**
     * ChaCha core function.
     */
    // prettier-ignore
    function chachaCore(c, k, n, out, cnt, rounds = 20) {
        let y00 = c[0], y01 = c[1], y02 = c[2], y03 = c[3]; // "expa"   "nd 3"  "2-by"  "te k"
        let y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3]; // Key      Key     Key     Key
        let y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7]; // Key      Key     Key     Key
        let y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2]; // Counter  Counter	Nonce   Nonce
        // Save state to temporary variables
        let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
        // Main loop
        for (let i = 0; i < rounds; i += 2) {
            x00 = (x00 + x04) | 0;
            x12 = rotl(x12 ^ x00, 16);
            x08 = (x08 + x12) | 0;
            x04 = rotl(x04 ^ x08, 12);
            x00 = (x00 + x04) | 0;
            x12 = rotl(x12 ^ x00, 8);
            x08 = (x08 + x12) | 0;
            x04 = rotl(x04 ^ x08, 7);
            x01 = (x01 + x05) | 0;
            x13 = rotl(x13 ^ x01, 16);
            x09 = (x09 + x13) | 0;
            x05 = rotl(x05 ^ x09, 12);
            x01 = (x01 + x05) | 0;
            x13 = rotl(x13 ^ x01, 8);
            x09 = (x09 + x13) | 0;
            x05 = rotl(x05 ^ x09, 7);
            x02 = (x02 + x06) | 0;
            x14 = rotl(x14 ^ x02, 16);
            x10 = (x10 + x14) | 0;
            x06 = rotl(x06 ^ x10, 12);
            x02 = (x02 + x06) | 0;
            x14 = rotl(x14 ^ x02, 8);
            x10 = (x10 + x14) | 0;
            x06 = rotl(x06 ^ x10, 7);
            x03 = (x03 + x07) | 0;
            x15 = rotl(x15 ^ x03, 16);
            x11 = (x11 + x15) | 0;
            x07 = rotl(x07 ^ x11, 12);
            x03 = (x03 + x07) | 0;
            x15 = rotl(x15 ^ x03, 8);
            x11 = (x11 + x15) | 0;
            x07 = rotl(x07 ^ x11, 7);
            x00 = (x00 + x05) | 0;
            x15 = rotl(x15 ^ x00, 16);
            x10 = (x10 + x15) | 0;
            x05 = rotl(x05 ^ x10, 12);
            x00 = (x00 + x05) | 0;
            x15 = rotl(x15 ^ x00, 8);
            x10 = (x10 + x15) | 0;
            x05 = rotl(x05 ^ x10, 7);
            x01 = (x01 + x06) | 0;
            x12 = rotl(x12 ^ x01, 16);
            x11 = (x11 + x12) | 0;
            x06 = rotl(x06 ^ x11, 12);
            x01 = (x01 + x06) | 0;
            x12 = rotl(x12 ^ x01, 8);
            x11 = (x11 + x12) | 0;
            x06 = rotl(x06 ^ x11, 7);
            x02 = (x02 + x07) | 0;
            x13 = rotl(x13 ^ x02, 16);
            x08 = (x08 + x13) | 0;
            x07 = rotl(x07 ^ x08, 12);
            x02 = (x02 + x07) | 0;
            x13 = rotl(x13 ^ x02, 8);
            x08 = (x08 + x13) | 0;
            x07 = rotl(x07 ^ x08, 7);
            x03 = (x03 + x04) | 0;
            x14 = rotl(x14 ^ x03, 16);
            x09 = (x09 + x14) | 0;
            x04 = rotl(x04 ^ x09, 12);
            x03 = (x03 + x04) | 0;
            x14 = rotl(x14 ^ x03, 8);
            x09 = (x09 + x14) | 0;
            x04 = rotl(x04 ^ x09, 7);
        }
        // Write output
        let oi = 0;
        out[oi++] = (y00 + x00) | 0;
        out[oi++] = (y01 + x01) | 0;
        out[oi++] = (y02 + x02) | 0;
        out[oi++] = (y03 + x03) | 0;
        out[oi++] = (y04 + x04) | 0;
        out[oi++] = (y05 + x05) | 0;
        out[oi++] = (y06 + x06) | 0;
        out[oi++] = (y07 + x07) | 0;
        out[oi++] = (y08 + x08) | 0;
        out[oi++] = (y09 + x09) | 0;
        out[oi++] = (y10 + x10) | 0;
        out[oi++] = (y11 + x11) | 0;
        out[oi++] = (y12 + x12) | 0;
        out[oi++] = (y13 + x13) | 0;
        out[oi++] = (y14 + x14) | 0;
        out[oi++] = (y15 + x15) | 0;
    }
    /**
     * ChaCha stream cipher. Conforms to RFC 8439 (IETF, TLS). 12-byte nonce, 4-byte counter.
     * With 12-byte nonce, it's not safe to use fill it with random (CSPRNG), due to collision chance.
     */
    const chacha20 = /* @__PURE__ */ salsaBasic({
        core: chachaCore,
        counterRight: false,
        counterLen: 4,
        allow128bitKeys: false,
    });

    // HMAC (RFC 2104)
    class HMAC extends Hash$1 {
        constructor(hash, _key) {
            super();
            this.finished = false;
            this.destroyed = false;
            assert$2.hash(hash);
            const key = toBytes$2(_key);
            this.iHash = hash.create();
            if (typeof this.iHash.update !== 'function')
                throw new Error('Expected instance of class which extends utils.Hash');
            this.blockLen = this.iHash.blockLen;
            this.outputLen = this.iHash.outputLen;
            const blockLen = this.blockLen;
            const pad = new Uint8Array(blockLen);
            // blockLen can be bigger than outputLen
            pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36;
            this.iHash.update(pad);
            // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
            this.oHash = hash.create();
            // Undo internal XOR && apply outer XOR
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36 ^ 0x5c;
            this.oHash.update(pad);
            pad.fill(0);
        }
        update(buf) {
            assert$2.exists(this);
            this.iHash.update(buf);
            return this;
        }
        digestInto(out) {
            assert$2.exists(this);
            assert$2.bytes(out, this.outputLen);
            this.finished = true;
            this.iHash.digestInto(out);
            this.oHash.update(out);
            this.oHash.digestInto(out);
            this.destroy();
        }
        digest() {
            const out = new Uint8Array(this.oHash.outputLen);
            this.digestInto(out);
            return out;
        }
        _cloneInto(to) {
            // Create new instance without calling constructor since key already in state and we don't know it.
            to || (to = Object.create(Object.getPrototypeOf(this), {}));
            const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
            to = to;
            to.finished = finished;
            to.destroyed = destroyed;
            to.blockLen = blockLen;
            to.outputLen = outputLen;
            to.oHash = oHash._cloneInto(to.oHash);
            to.iHash = iHash._cloneInto(to.iHash);
            return to;
        }
        destroy() {
            this.destroyed = true;
            this.oHash.destroy();
            this.iHash.destroy();
        }
    }
    /**
     * HMAC: RFC2104 message authentication code.
     * @param hash - function that would be used e.g. sha256
     * @param key - message key
     * @param message - message data
     */
    const hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
    hmac.create = (hash, key) => new HMAC(hash, key);

    // HKDF (RFC 5869)
    // https://soatok.blog/2021/11/17/understanding-hkdf/
    /**
     * HKDF-Extract(IKM, salt) -> PRK
     * Arguments position differs from spec (IKM is first one, since it is not optional)
     * @param hash
     * @param ikm
     * @param salt
     * @returns
     */
    function extract(hash, ikm, salt) {
        assert$2.hash(hash);
        // NOTE: some libraries treat zero-length array as 'not provided';
        // we don't, since we have undefined as 'not provided'
        // https://github.com/RustCrypto/KDFs/issues/15
        if (salt === undefined)
            salt = new Uint8Array(hash.outputLen); // if not provided, it is set to a string of HashLen zeros
        return hmac(hash, toBytes$2(salt), toBytes$2(ikm));
    }
    // HKDF-Expand(PRK, info, L) -> OKM
    const HKDF_COUNTER = new Uint8Array([0]);
    const EMPTY_BUFFER = new Uint8Array();
    /**
     * HKDF-expand from the spec.
     * @param prk - a pseudorandom key of at least HashLen octets (usually, the output from the extract step)
     * @param info - optional context and application specific information (can be a zero-length string)
     * @param length - length of output keying material in octets
     */
    function expand(hash, prk, info, length = 32) {
        assert$2.hash(hash);
        assert$2.number(length);
        if (length > 255 * hash.outputLen)
            throw new Error('Length should be <= 255*HashLen');
        const blocks = Math.ceil(length / hash.outputLen);
        if (info === undefined)
            info = EMPTY_BUFFER;
        // first L(ength) octets of T
        const okm = new Uint8Array(blocks * hash.outputLen);
        // Re-use HMAC instance between blocks
        const HMAC = hmac.create(hash, prk);
        const HMACTmp = HMAC._cloneInto();
        const T = new Uint8Array(HMAC.outputLen);
        for (let counter = 0; counter < blocks; counter++) {
            HKDF_COUNTER[0] = counter + 1;
            // T(0) = empty string (zero length)
            // T(N) = HMAC-Hash(PRK, T(N-1) | info | N)
            HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T)
                .update(info)
                .update(HKDF_COUNTER)
                .digestInto(T);
            okm.set(T, hash.outputLen * counter);
            HMAC._cloneInto(HMACTmp);
        }
        HMAC.destroy();
        HMACTmp.destroy();
        T.fill(0);
        HKDF_COUNTER.fill(0);
        return okm.slice(0, length);
    }
    /**
     * HKDF (RFC 5869): extract + expand in one step.
     * @param hash - hash function that would be used (e.g. sha256)
     * @param ikm - input keying material, the initial key
     * @param salt - optional salt value (a non-secret random value)
     * @param info - optional context and application specific information
     * @param length - length of output keying material in octets
     */
    const hkdf = (hash, ikm, salt, info, length) => expand(hash, extract(hash, ikm, salt), info, length);

    var __defProp = Object.defineProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    function generatePrivateKey() {
      return bytesToHex$1(schnorr.utils.randomPrivateKey());
    }
    function getPublicKey(privateKey) {
      return bytesToHex$1(schnorr.getPublicKey(privateKey));
    }

    // utils.ts
    var utils_exports = {};
    __export(utils_exports, {
      MessageNode: () => MessageNode,
      MessageQueue: () => MessageQueue,
      insertEventIntoAscendingList: () => insertEventIntoAscendingList,
      insertEventIntoDescendingList: () => insertEventIntoDescendingList,
      normalizeURL: () => normalizeURL,
      utf8Decoder: () => utf8Decoder,
      utf8Encoder: () => utf8Encoder
    });
    var utf8Decoder = new TextDecoder("utf-8");
    var utf8Encoder = new TextEncoder();
    function normalizeURL(url) {
      let p = new URL(url);
      p.pathname = p.pathname.replace(/\/+/g, "/");
      if (p.pathname.endsWith("/"))
        p.pathname = p.pathname.slice(0, -1);
      if (p.port === "80" && p.protocol === "ws:" || p.port === "443" && p.protocol === "wss:")
        p.port = "";
      p.searchParams.sort();
      p.hash = "";
      return p.toString();
    }
    function insertEventIntoDescendingList(sortedArray, event) {
      let start = 0;
      let end = sortedArray.length - 1;
      let midPoint;
      let position = start;
      if (end < 0) {
        position = 0;
      } else if (event.created_at < sortedArray[end].created_at) {
        position = end + 1;
      } else if (event.created_at >= sortedArray[start].created_at) {
        position = start;
      } else
        while (true) {
          if (end <= start + 1) {
            position = end;
            break;
          }
          midPoint = Math.floor(start + (end - start) / 2);
          if (sortedArray[midPoint].created_at > event.created_at) {
            start = midPoint;
          } else if (sortedArray[midPoint].created_at < event.created_at) {
            end = midPoint;
          } else {
            position = midPoint;
            break;
          }
        }
      if (sortedArray[position]?.id !== event.id) {
        return [...sortedArray.slice(0, position), event, ...sortedArray.slice(position)];
      }
      return sortedArray;
    }
    function insertEventIntoAscendingList(sortedArray, event) {
      let start = 0;
      let end = sortedArray.length - 1;
      let midPoint;
      let position = start;
      if (end < 0) {
        position = 0;
      } else if (event.created_at > sortedArray[end].created_at) {
        position = end + 1;
      } else if (event.created_at <= sortedArray[start].created_at) {
        position = start;
      } else
        while (true) {
          if (end <= start + 1) {
            position = end;
            break;
          }
          midPoint = Math.floor(start + (end - start) / 2);
          if (sortedArray[midPoint].created_at < event.created_at) {
            start = midPoint;
          } else if (sortedArray[midPoint].created_at > event.created_at) {
            end = midPoint;
          } else {
            position = midPoint;
            break;
          }
        }
      if (sortedArray[position]?.id !== event.id) {
        return [...sortedArray.slice(0, position), event, ...sortedArray.slice(position)];
      }
      return sortedArray;
    }
    var MessageNode = class {
      _value;
      _next;
      get value() {
        return this._value;
      }
      set value(message) {
        this._value = message;
      }
      get next() {
        return this._next;
      }
      set next(node) {
        this._next = node;
      }
      constructor(message) {
        this._value = message;
        this._next = null;
      }
    };
    var MessageQueue = class {
      _first;
      _last;
      get first() {
        return this._first;
      }
      set first(messageNode) {
        this._first = messageNode;
      }
      get last() {
        return this._last;
      }
      set last(messageNode) {
        this._last = messageNode;
      }
      _size;
      get size() {
        return this._size;
      }
      set size(v) {
        this._size = v;
      }
      constructor() {
        this._first = null;
        this._last = null;
        this._size = 0;
      }
      enqueue(message) {
        const newNode = new MessageNode(message);
        if (this._size === 0 || !this._last) {
          this._first = newNode;
          this._last = newNode;
        } else {
          this._last.next = newNode;
          this._last = newNode;
        }
        this._size++;
        return true;
      }
      dequeue() {
        if (this._size === 0 || !this._first)
          return null;
        let prev = this._first;
        this._first = prev.next;
        prev.next = null;
        this._size--;
        return prev.value;
      }
    };

    // event.ts
    var verifiedSymbol = Symbol("verified");
    function getBlankEvent(kind = 255 /* Blank */) {
      return {
        kind,
        content: "",
        tags: [],
        created_at: 0
      };
    }
    function finishEvent(t, privateKey) {
      const event = t;
      event.pubkey = getPublicKey(privateKey);
      event.id = getEventHash(event);
      event.sig = getSignature(event, privateKey);
      event[verifiedSymbol] = true;
      return event;
    }
    function serializeEvent(evt) {
      if (!validateEvent(evt))
        throw new Error("can't serialize event with wrong or missing properties");
      return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
    }
    function getEventHash(event) {
      let eventHash = sha256$1(utf8Encoder.encode(serializeEvent(event)));
      return bytesToHex$1(eventHash);
    }
    var isRecord = (obj) => obj instanceof Object;
    function validateEvent(event) {
      if (!isRecord(event))
        return false;
      if (typeof event.kind !== "number")
        return false;
      if (typeof event.content !== "string")
        return false;
      if (typeof event.created_at !== "number")
        return false;
      if (typeof event.pubkey !== "string")
        return false;
      if (!event.pubkey.match(/^[a-f0-9]{64}$/))
        return false;
      if (!Array.isArray(event.tags))
        return false;
      for (let i = 0; i < event.tags.length; i++) {
        let tag = event.tags[i];
        if (!Array.isArray(tag))
          return false;
        for (let j = 0; j < tag.length; j++) {
          if (typeof tag[j] === "object")
            return false;
        }
      }
      return true;
    }
    function verifySignature(event) {
      if (typeof event[verifiedSymbol] === "boolean")
        return event[verifiedSymbol];
      const hash = getEventHash(event);
      if (hash !== event.id) {
        return event[verifiedSymbol] = false;
      }
      try {
        return event[verifiedSymbol] = schnorr.verify(event.sig, hash, event.pubkey);
      } catch (err) {
        return event[verifiedSymbol] = false;
      }
    }
    function getSignature(event, key) {
      return bytesToHex$1(schnorr.sign(getEventHash(event), key));
    }

    // filter.ts
    function matchFilter(filter, event) {
      if (filter.ids && filter.ids.indexOf(event.id) === -1) {
        if (!filter.ids.some((prefix) => event.id.startsWith(prefix))) {
          return false;
        }
      }
      if (filter.kinds && filter.kinds.indexOf(event.kind) === -1)
        return false;
      if (filter.authors && filter.authors.indexOf(event.pubkey) === -1) {
        if (!filter.authors.some((prefix) => event.pubkey.startsWith(prefix))) {
          return false;
        }
      }
      for (let f in filter) {
        if (f[0] === "#") {
          let tagName = f.slice(1);
          let values = filter[`#${tagName}`];
          if (values && !event.tags.find(([t, v]) => t === f.slice(1) && values.indexOf(v) !== -1))
            return false;
        }
      }
      if (filter.since && event.created_at < filter.since)
        return false;
      if (filter.until && event.created_at > filter.until)
        return false;
      return true;
    }
    function matchFilters(filters, event) {
      for (let i = 0; i < filters.length; i++) {
        if (matchFilter(filters[i], event))
          return true;
      }
      return false;
    }

    // fakejson.ts
    var fakejson_exports = {};
    __export(fakejson_exports, {
      getHex64: () => getHex64,
      getInt: () => getInt,
      getSubscriptionId: () => getSubscriptionId,
      matchEventId: () => matchEventId,
      matchEventKind: () => matchEventKind,
      matchEventPubkey: () => matchEventPubkey
    });
    function getHex64(json, field) {
      let len = field.length + 3;
      let idx = json.indexOf(`"${field}":`) + len;
      let s = json.slice(idx).indexOf(`"`) + idx + 1;
      return json.slice(s, s + 64);
    }
    function getInt(json, field) {
      let len = field.length;
      let idx = json.indexOf(`"${field}":`) + len + 3;
      let sliced = json.slice(idx);
      let end = Math.min(sliced.indexOf(","), sliced.indexOf("}"));
      return parseInt(sliced.slice(0, end), 10);
    }
    function getSubscriptionId(json) {
      let idx = json.slice(0, 22).indexOf(`"EVENT"`);
      if (idx === -1)
        return null;
      let pstart = json.slice(idx + 7 + 1).indexOf(`"`);
      if (pstart === -1)
        return null;
      let start = idx + 7 + 1 + pstart;
      let pend = json.slice(start + 1, 80).indexOf(`"`);
      if (pend === -1)
        return null;
      let end = start + 1 + pend;
      return json.slice(start + 1, end);
    }
    function matchEventId(json, id) {
      return id === getHex64(json, "id");
    }
    function matchEventPubkey(json, pubkey) {
      return pubkey === getHex64(json, "pubkey");
    }
    function matchEventKind(json, kind) {
      return kind === getInt(json, "kind");
    }

    // relay.ts
    var newListeners = () => ({
      connect: [],
      disconnect: [],
      error: [],
      notice: [],
      auth: []
    });
    function relayInit(url, options = {}) {
      let { listTimeout = 3e3, getTimeout = 3e3, countTimeout = 3e3 } = options;
      var ws;
      var openSubs = {};
      var listeners = newListeners();
      var subListeners = {};
      var pubListeners = {};
      var connectionPromise;
      async function connectRelay() {
        if (connectionPromise)
          return connectionPromise;
        connectionPromise = new Promise((resolve, reject) => {
          try {
            ws = new WebSocket(url);
          } catch (err) {
            reject(err);
          }
          ws.onopen = () => {
            listeners.connect.forEach((cb) => cb());
            resolve();
          };
          ws.onerror = () => {
            connectionPromise = void 0;
            listeners.error.forEach((cb) => cb());
            reject();
          };
          ws.onclose = async () => {
            connectionPromise = void 0;
            listeners.disconnect.forEach((cb) => cb());
          };
          let incomingMessageQueue = new MessageQueue();
          let handleNextInterval;
          ws.onmessage = (e) => {
            incomingMessageQueue.enqueue(e.data);
            if (!handleNextInterval) {
              handleNextInterval = setInterval(handleNext, 0);
            }
          };
          function handleNext() {
            if (incomingMessageQueue.size === 0) {
              clearInterval(handleNextInterval);
              handleNextInterval = null;
              return;
            }
            var json = incomingMessageQueue.dequeue();
            if (!json)
              return;
            let subid = getSubscriptionId(json);
            if (subid) {
              let so = openSubs[subid];
              if (so && so.alreadyHaveEvent && so.alreadyHaveEvent(getHex64(json, "id"), url)) {
                return;
              }
            }
            try {
              let data = JSON.parse(json);
              switch (data[0]) {
                case "EVENT": {
                  let id2 = data[1];
                  let event = data[2];
                  if (validateEvent(event) && openSubs[id2] && (openSubs[id2].skipVerification || verifySignature(event)) && matchFilters(openSubs[id2].filters, event)) {
                    openSubs[id2];
                    (subListeners[id2]?.event || []).forEach((cb) => cb(event));
                  }
                  return;
                }
                case "COUNT":
                  let id = data[1];
                  let payload = data[2];
                  if (openSubs[id]) {
                    ;
                    (subListeners[id]?.count || []).forEach((cb) => cb(payload));
                  }
                  return;
                case "EOSE": {
                  let id2 = data[1];
                  if (id2 in subListeners) {
                    subListeners[id2].eose.forEach((cb) => cb());
                    subListeners[id2].eose = [];
                  }
                  return;
                }
                case "OK": {
                  let id2 = data[1];
                  let ok = data[2];
                  let reason = data[3] || "";
                  if (id2 in pubListeners) {
                    let { resolve: resolve2, reject: reject2 } = pubListeners[id2];
                    if (ok)
                      resolve2(null);
                    else
                      reject2(new Error(reason));
                  }
                  return;
                }
                case "NOTICE":
                  let notice = data[1];
                  listeners.notice.forEach((cb) => cb(notice));
                  return;
                case "AUTH": {
                  let challenge = data[1];
                  listeners.auth?.forEach((cb) => cb(challenge));
                  return;
                }
              }
            } catch (err) {
              return;
            }
          }
        });
        return connectionPromise;
      }
      function connected() {
        return ws?.readyState === 1;
      }
      async function connect() {
        if (connected())
          return;
        await connectRelay();
      }
      async function trySend(params) {
        let msg = JSON.stringify(params);
        if (!connected()) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          if (!connected()) {
            return;
          }
        }
        try {
          ws.send(msg);
        } catch (err) {
          console.log(err);
        }
      }
      const sub = (filters, {
        verb = "REQ",
        skipVerification = false,
        alreadyHaveEvent = null,
        id = Math.random().toString().slice(2)
      } = {}) => {
        let subid = id;
        openSubs[subid] = {
          id: subid,
          filters,
          skipVerification,
          alreadyHaveEvent
        };
        trySend([verb, subid, ...filters]);
        let subscription = {
          sub: (newFilters, newOpts = {}) => sub(newFilters || filters, {
            skipVerification: newOpts.skipVerification || skipVerification,
            alreadyHaveEvent: newOpts.alreadyHaveEvent || alreadyHaveEvent,
            id: subid
          }),
          unsub: () => {
            delete openSubs[subid];
            delete subListeners[subid];
            trySend(["CLOSE", subid]);
          },
          on: (type, cb) => {
            subListeners[subid] = subListeners[subid] || {
              event: [],
              count: [],
              eose: []
            };
            subListeners[subid][type].push(cb);
          },
          off: (type, cb) => {
            let listeners2 = subListeners[subid];
            let idx = listeners2[type].indexOf(cb);
            if (idx >= 0)
              listeners2[type].splice(idx, 1);
          },
          get events() {
            return eventsGenerator(subscription);
          }
        };
        return subscription;
      };
      function _publishEvent(event, type) {
        return new Promise((resolve, reject) => {
          if (!event.id) {
            reject(new Error(`event ${event} has no id`));
            return;
          }
          let id = event.id;
          trySend([type, event]);
          pubListeners[id] = { resolve, reject };
        });
      }
      return {
        url,
        sub,
        on: (type, cb) => {
          listeners[type].push(cb);
          if (type === "connect" && ws?.readyState === 1) {
            cb();
          }
        },
        off: (type, cb) => {
          let index = listeners[type].indexOf(cb);
          if (index !== -1)
            listeners[type].splice(index, 1);
        },
        list: (filters, opts) => new Promise((resolve) => {
          let s = sub(filters, opts);
          let events = [];
          let timeout = setTimeout(() => {
            s.unsub();
            resolve(events);
          }, listTimeout);
          s.on("eose", () => {
            s.unsub();
            clearTimeout(timeout);
            resolve(events);
          });
          s.on("event", (event) => {
            events.push(event);
          });
        }),
        get: (filter, opts) => new Promise((resolve) => {
          let s = sub([filter], opts);
          let timeout = setTimeout(() => {
            s.unsub();
            resolve(null);
          }, getTimeout);
          s.on("event", (event) => {
            s.unsub();
            clearTimeout(timeout);
            resolve(event);
          });
        }),
        count: (filters) => new Promise((resolve) => {
          let s = sub(filters, { ...sub, verb: "COUNT" });
          let timeout = setTimeout(() => {
            s.unsub();
            resolve(null);
          }, countTimeout);
          s.on("count", (event) => {
            s.unsub();
            clearTimeout(timeout);
            resolve(event);
          });
        }),
        async publish(event) {
          await _publishEvent(event, "EVENT");
        },
        async auth(event) {
          await _publishEvent(event, "AUTH");
        },
        connect,
        close() {
          listeners = newListeners();
          subListeners = {};
          pubListeners = {};
          if (ws?.readyState === WebSocket.OPEN) {
            ws.close();
          }
        },
        get status() {
          return ws?.readyState ?? 3;
        }
      };
    }
    async function* eventsGenerator(sub) {
      let nextResolve;
      const eventQueue = [];
      const pushToQueue = (event) => {
        if (nextResolve) {
          nextResolve(event);
          nextResolve = void 0;
        } else {
          eventQueue.push(event);
        }
      };
      sub.on("event", pushToQueue);
      try {
        while (true) {
          if (eventQueue.length > 0) {
            yield eventQueue.shift();
          } else {
            const event = await new Promise((resolve) => {
              nextResolve = resolve;
            });
            yield event;
          }
        }
      } finally {
        sub.off("event", pushToQueue);
      }
    }

    // nip19.ts
    var nip19_exports = {};
    __export(nip19_exports, {
      BECH32_REGEX: () => BECH32_REGEX,
      decode: () => decode,
      naddrEncode: () => naddrEncode,
      neventEncode: () => neventEncode,
      noteEncode: () => noteEncode,
      nprofileEncode: () => nprofileEncode,
      npubEncode: () => npubEncode,
      nrelayEncode: () => nrelayEncode,
      nsecEncode: () => nsecEncode
    });
    var Bech32MaxSize = 5e3;
    var BECH32_REGEX = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/;
    function integerToUint8Array(number) {
      const uint8Array = new Uint8Array(4);
      uint8Array[0] = number >> 24 & 255;
      uint8Array[1] = number >> 16 & 255;
      uint8Array[2] = number >> 8 & 255;
      uint8Array[3] = number & 255;
      return uint8Array;
    }
    function decode(nip19) {
      let { prefix, words } = bech32$1.decode(nip19, Bech32MaxSize);
      let data = new Uint8Array(bech32$1.fromWords(words));
      switch (prefix) {
        case "nprofile": {
          let tlv = parseTLV(data);
          if (!tlv[0]?.[0])
            throw new Error("missing TLV 0 for nprofile");
          if (tlv[0][0].length !== 32)
            throw new Error("TLV 0 should be 32 bytes");
          return {
            type: "nprofile",
            data: {
              pubkey: bytesToHex$1(tlv[0][0]),
              relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
            }
          };
        }
        case "nevent": {
          let tlv = parseTLV(data);
          if (!tlv[0]?.[0])
            throw new Error("missing TLV 0 for nevent");
          if (tlv[0][0].length !== 32)
            throw new Error("TLV 0 should be 32 bytes");
          if (tlv[2] && tlv[2][0].length !== 32)
            throw new Error("TLV 2 should be 32 bytes");
          if (tlv[3] && tlv[3][0].length !== 4)
            throw new Error("TLV 3 should be 4 bytes");
          return {
            type: "nevent",
            data: {
              id: bytesToHex$1(tlv[0][0]),
              relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
              author: tlv[2]?.[0] ? bytesToHex$1(tlv[2][0]) : void 0,
              kind: tlv[3]?.[0] ? parseInt(bytesToHex$1(tlv[3][0]), 16) : void 0
            }
          };
        }
        case "naddr": {
          let tlv = parseTLV(data);
          if (!tlv[0]?.[0])
            throw new Error("missing TLV 0 for naddr");
          if (!tlv[2]?.[0])
            throw new Error("missing TLV 2 for naddr");
          if (tlv[2][0].length !== 32)
            throw new Error("TLV 2 should be 32 bytes");
          if (!tlv[3]?.[0])
            throw new Error("missing TLV 3 for naddr");
          if (tlv[3][0].length !== 4)
            throw new Error("TLV 3 should be 4 bytes");
          return {
            type: "naddr",
            data: {
              identifier: utf8Decoder.decode(tlv[0][0]),
              pubkey: bytesToHex$1(tlv[2][0]),
              kind: parseInt(bytesToHex$1(tlv[3][0]), 16),
              relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
            }
          };
        }
        case "nrelay": {
          let tlv = parseTLV(data);
          if (!tlv[0]?.[0])
            throw new Error("missing TLV 0 for nrelay");
          return {
            type: "nrelay",
            data: utf8Decoder.decode(tlv[0][0])
          };
        }
        case "nsec":
        case "npub":
        case "note":
          return { type: prefix, data: bytesToHex$1(data) };
        default:
          throw new Error(`unknown prefix ${prefix}`);
      }
    }
    function parseTLV(data) {
      let result = {};
      let rest = data;
      while (rest.length > 0) {
        let t = rest[0];
        let l = rest[1];
        if (!l)
          throw new Error(`malformed TLV ${t}`);
        let v = rest.slice(2, 2 + l);
        rest = rest.slice(2 + l);
        if (v.length < l)
          throw new Error(`not enough data to read on TLV ${t}`);
        result[t] = result[t] || [];
        result[t].push(v);
      }
      return result;
    }
    function nsecEncode(hex) {
      return encodeBytes("nsec", hex);
    }
    function npubEncode(hex) {
      return encodeBytes("npub", hex);
    }
    function noteEncode(hex) {
      return encodeBytes("note", hex);
    }
    function encodeBech32(prefix, data) {
      let words = bech32$1.toWords(data);
      return bech32$1.encode(prefix, words, Bech32MaxSize);
    }
    function encodeBytes(prefix, hex) {
      let data = hexToBytes$1(hex);
      return encodeBech32(prefix, data);
    }
    function nprofileEncode(profile) {
      let data = encodeTLV({
        0: [hexToBytes$1(profile.pubkey)],
        1: (profile.relays || []).map((url) => utf8Encoder.encode(url))
      });
      return encodeBech32("nprofile", data);
    }
    function neventEncode(event) {
      let kindArray;
      if (event.kind != void 0) {
        kindArray = integerToUint8Array(event.kind);
      }
      let data = encodeTLV({
        0: [hexToBytes$1(event.id)],
        1: (event.relays || []).map((url) => utf8Encoder.encode(url)),
        2: event.author ? [hexToBytes$1(event.author)] : [],
        3: kindArray ? [new Uint8Array(kindArray)] : []
      });
      return encodeBech32("nevent", data);
    }
    function naddrEncode(addr) {
      let kind = new ArrayBuffer(4);
      new DataView(kind).setUint32(0, addr.kind, false);
      let data = encodeTLV({
        0: [utf8Encoder.encode(addr.identifier)],
        1: (addr.relays || []).map((url) => utf8Encoder.encode(url)),
        2: [hexToBytes$1(addr.pubkey)],
        3: [new Uint8Array(kind)]
      });
      return encodeBech32("naddr", data);
    }
    function nrelayEncode(url) {
      let data = encodeTLV({
        0: [utf8Encoder.encode(url)]
      });
      return encodeBech32("nrelay", data);
    }
    function encodeTLV(tlv) {
      let entries = [];
      Object.entries(tlv).forEach(([t, vs]) => {
        vs.forEach((v) => {
          let entry = new Uint8Array(v.length + 2);
          entry.set([parseInt(t)], 0);
          entry.set([v.length], 1);
          entry.set(v, 2);
          entries.push(entry);
        });
      });
      return concatBytes$1(...entries);
    }

    // nip04.ts
    var nip04_exports = {};
    __export(nip04_exports, {
      decrypt: () => decrypt$1,
      encrypt: () => encrypt$1
    });
    if (typeof crypto !== "undefined" && !crypto.subtle && crypto.webcrypto) {
      crypto.subtle = crypto.webcrypto.subtle;
    }
    async function encrypt$1(privkey, pubkey, text) {
      const key = secp256k1.getSharedSecret(privkey, "02" + pubkey);
      const normalizedKey = getNormalizedX(key);
      let iv = Uint8Array.from(randomBytes$1(16));
      let plaintext = utf8Encoder.encode(text);
      let cryptoKey = await crypto.subtle.importKey("raw", normalizedKey, { name: "AES-CBC" }, false, ["encrypt"]);
      let ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, plaintext);
      let ctb64 = base64.encode(new Uint8Array(ciphertext));
      let ivb64 = base64.encode(new Uint8Array(iv.buffer));
      return `${ctb64}?iv=${ivb64}`;
    }
    async function decrypt$1(privkey, pubkey, data) {
      let [ctb64, ivb64] = data.split("?iv=");
      let key = secp256k1.getSharedSecret(privkey, "02" + pubkey);
      let normalizedKey = getNormalizedX(key);
      let cryptoKey = await crypto.subtle.importKey("raw", normalizedKey, { name: "AES-CBC" }, false, ["decrypt"]);
      let ciphertext = base64.decode(ctb64);
      let iv = base64.decode(ivb64);
      let plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, ciphertext);
      let text = utf8Decoder.decode(plaintext);
      return text;
    }
    function getNormalizedX(key) {
      return key.slice(1, 33);
    }

    // nip05.ts
    var nip05_exports = {};
    __export(nip05_exports, {
      NIP05_REGEX: () => NIP05_REGEX$1,
      queryProfile: () => queryProfile,
      searchDomain: () => searchDomain,
      useFetchImplementation: () => useFetchImplementation
    });
    var NIP05_REGEX$1 = /^(?:([\w.+-]+)@)?([\w.-]+)$/;
    var _fetch;
    try {
      _fetch = fetch;
    } catch {
    }
    function useFetchImplementation(fetchImplementation) {
      _fetch = fetchImplementation;
    }
    async function searchDomain(domain, query = "") {
      try {
        let res = await (await _fetch(`https://${domain}/.well-known/nostr.json?name=${query}`)).json();
        return res.names;
      } catch (_) {
        return {};
      }
    }
    async function queryProfile(fullname) {
      const match = fullname.match(NIP05_REGEX$1);
      if (!match)
        return null;
      const [_, name = "_", domain] = match;
      try {
        const res = await _fetch(`https://${domain}/.well-known/nostr.json?name=${name}`);
        const { names, relays } = parseNIP05Result$1(await res.json());
        const pubkey = names[name];
        return pubkey ? { pubkey, relays: relays?.[pubkey] } : null;
      } catch (_e) {
        return null;
      }
    }
    function parseNIP05Result$1(json) {
      const result = {
        names: {}
      };
      for (const [name, pubkey] of Object.entries(json.names)) {
        if (typeof name === "string" && typeof pubkey === "string") {
          result.names[name] = pubkey;
        }
      }
      if (json.relays) {
        result.relays = {};
        for (const [pubkey, relays] of Object.entries(json.relays)) {
          if (typeof pubkey === "string" && Array.isArray(relays)) {
            result.relays[pubkey] = relays.filter((relay) => typeof relay === "string");
          }
        }
      }
      return result;
    }

    // nip06.ts
    var nip06_exports = {};
    __export(nip06_exports, {
      generateSeedWords: () => generateSeedWords,
      privateKeyFromSeedWords: () => privateKeyFromSeedWords,
      validateWords: () => validateWords
    });
    function privateKeyFromSeedWords(mnemonic, passphrase) {
      let root = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic, passphrase));
      let privateKey = root.derive(`m/44'/1237'/0'/0/0`).privateKey;
      if (!privateKey)
        throw new Error("could not derive private key");
      return bytesToHex$1(privateKey);
    }
    function generateSeedWords() {
      return generateMnemonic(wordlist);
    }
    function validateWords(words) {
      return validateMnemonic(words, wordlist);
    }

    // nip10.ts
    var nip10_exports = {};
    __export(nip10_exports, {
      parse: () => parse
    });
    function parse(event) {
      const result = {
        reply: void 0,
        root: void 0,
        mentions: [],
        profiles: []
      };
      const eTags = [];
      for (const tag of event.tags) {
        if (tag[0] === "e" && tag[1]) {
          eTags.push(tag);
        }
        if (tag[0] === "p" && tag[1]) {
          result.profiles.push({
            pubkey: tag[1],
            relays: tag[2] ? [tag[2]] : []
          });
        }
      }
      for (let eTagIndex = 0; eTagIndex < eTags.length; eTagIndex++) {
        const eTag = eTags[eTagIndex];
        const [_, eTagEventId, eTagRelayUrl, eTagMarker] = eTag;
        const eventPointer = {
          id: eTagEventId,
          relays: eTagRelayUrl ? [eTagRelayUrl] : []
        };
        const isFirstETag = eTagIndex === 0;
        const isLastETag = eTagIndex === eTags.length - 1;
        if (eTagMarker === "root") {
          result.root = eventPointer;
          continue;
        }
        if (eTagMarker === "reply") {
          result.reply = eventPointer;
          continue;
        }
        if (eTagMarker === "mention") {
          result.mentions.push(eventPointer);
          continue;
        }
        if (isFirstETag) {
          result.root = eventPointer;
          continue;
        }
        if (isLastETag) {
          result.reply = eventPointer;
          continue;
        }
        result.mentions.push(eventPointer);
      }
      return result;
    }

    // nip13.ts
    var nip13_exports = {};
    __export(nip13_exports, {
      getPow: () => getPow,
      minePow: () => minePow
    });
    function getPow(hex) {
      let count = 0;
      for (let i = 0; i < hex.length; i++) {
        const nibble = parseInt(hex[i], 16);
        if (nibble === 0) {
          count += 4;
        } else {
          count += Math.clz32(nibble) - 28;
          break;
        }
      }
      return count;
    }
    function minePow(unsigned, difficulty) {
      let count = 0;
      const event = unsigned;
      const tag = ["nonce", count.toString(), difficulty.toString()];
      event.tags.push(tag);
      while (true) {
        const now = Math.floor(new Date().getTime() / 1e3);
        if (now !== event.created_at) {
          count = 0;
          event.created_at = now;
        }
        tag[1] = (++count).toString();
        event.id = getEventHash(event);
        if (getPow(event.id) >= difficulty) {
          break;
        }
      }
      return event;
    }

    // nip18.ts
    var nip18_exports = {};
    __export(nip18_exports, {
      finishRepostEvent: () => finishRepostEvent,
      getRepostedEvent: () => getRepostedEvent,
      getRepostedEventPointer: () => getRepostedEventPointer
    });
    function finishRepostEvent(t, reposted, relayUrl, privateKey) {
      return finishEvent(
        {
          kind: 6 /* Repost */,
          tags: [...t.tags ?? [], ["e", reposted.id, relayUrl], ["p", reposted.pubkey]],
          content: t.content === "" ? "" : JSON.stringify(reposted),
          created_at: t.created_at
        },
        privateKey
      );
    }
    function getRepostedEventPointer(event) {
      if (event.kind !== 6 /* Repost */) {
        return void 0;
      }
      let lastETag;
      let lastPTag;
      for (let i = event.tags.length - 1; i >= 0 && (lastETag === void 0 || lastPTag === void 0); i--) {
        const tag = event.tags[i];
        if (tag.length >= 2) {
          if (tag[0] === "e" && lastETag === void 0) {
            lastETag = tag;
          } else if (tag[0] === "p" && lastPTag === void 0) {
            lastPTag = tag;
          }
        }
      }
      if (lastETag === void 0) {
        return void 0;
      }
      return {
        id: lastETag[1],
        relays: [lastETag[2], lastPTag?.[2]].filter((x) => typeof x === "string"),
        author: lastPTag?.[1]
      };
    }
    function getRepostedEvent(event, { skipVerification } = {}) {
      const pointer = getRepostedEventPointer(event);
      if (pointer === void 0 || event.content === "") {
        return void 0;
      }
      let repostedEvent;
      try {
        repostedEvent = JSON.parse(event.content);
      } catch (error) {
        return void 0;
      }
      if (repostedEvent.id !== pointer.id) {
        return void 0;
      }
      if (!skipVerification && !verifySignature(repostedEvent)) {
        return void 0;
      }
      return repostedEvent;
    }

    // nip21.ts
    var nip21_exports = {};
    __export(nip21_exports, {
      NOSTR_URI_REGEX: () => NOSTR_URI_REGEX,
      parse: () => parse2,
      test: () => test
    });
    var NOSTR_URI_REGEX = new RegExp(`nostr:(${BECH32_REGEX.source})`);
    function test(value) {
      return typeof value === "string" && new RegExp(`^${NOSTR_URI_REGEX.source}$`).test(value);
    }
    function parse2(uri) {
      const match = uri.match(new RegExp(`^${NOSTR_URI_REGEX.source}$`));
      if (!match)
        throw new Error(`Invalid Nostr URI: ${uri}`);
      return {
        uri: match[0],
        value: match[1],
        decoded: decode(match[1])
      };
    }

    // nip25.ts
    var nip25_exports = {};
    __export(nip25_exports, {
      finishReactionEvent: () => finishReactionEvent,
      getReactedEventPointer: () => getReactedEventPointer
    });
    function finishReactionEvent(t, reacted, privateKey) {
      const inheritedTags = reacted.tags.filter((tag) => tag.length >= 2 && (tag[0] === "e" || tag[0] === "p"));
      return finishEvent(
        {
          ...t,
          kind: 7 /* Reaction */,
          tags: [...t.tags ?? [], ...inheritedTags, ["e", reacted.id], ["p", reacted.pubkey]],
          content: t.content ?? "+"
        },
        privateKey
      );
    }
    function getReactedEventPointer(event) {
      if (event.kind !== 7 /* Reaction */) {
        return void 0;
      }
      let lastETag;
      let lastPTag;
      for (let i = event.tags.length - 1; i >= 0 && (lastETag === void 0 || lastPTag === void 0); i--) {
        const tag = event.tags[i];
        if (tag.length >= 2) {
          if (tag[0] === "e" && lastETag === void 0) {
            lastETag = tag;
          } else if (tag[0] === "p" && lastPTag === void 0) {
            lastPTag = tag;
          }
        }
      }
      if (lastETag === void 0 || lastPTag === void 0) {
        return void 0;
      }
      return {
        id: lastETag[1],
        relays: [lastETag[2], lastPTag[2]].filter((x) => x !== void 0),
        author: lastPTag[1]
      };
    }

    // nip26.ts
    var nip26_exports = {};
    __export(nip26_exports, {
      createDelegation: () => createDelegation,
      getDelegator: () => getDelegator
    });
    function createDelegation(privateKey, parameters) {
      let conditions = [];
      if ((parameters.kind || -1) >= 0)
        conditions.push(`kind=${parameters.kind}`);
      if (parameters.until)
        conditions.push(`created_at<${parameters.until}`);
      if (parameters.since)
        conditions.push(`created_at>${parameters.since}`);
      let cond = conditions.join("&");
      if (cond === "")
        throw new Error("refusing to create a delegation without any conditions");
      let sighash = sha256$1(utf8Encoder.encode(`nostr:delegation:${parameters.pubkey}:${cond}`));
      let sig = bytesToHex$1(schnorr.sign(sighash, privateKey));
      return {
        from: getPublicKey(privateKey),
        to: parameters.pubkey,
        cond,
        sig
      };
    }
    function getDelegator(event) {
      let tag = event.tags.find((tag2) => tag2[0] === "delegation" && tag2.length >= 4);
      if (!tag)
        return null;
      let pubkey = tag[1];
      let cond = tag[2];
      let sig = tag[3];
      let conditions = cond.split("&");
      for (let i = 0; i < conditions.length; i++) {
        let [key, operator, value] = conditions[i].split(/\b/);
        if (key === "kind" && operator === "=" && event.kind === parseInt(value))
          continue;
        else if (key === "created_at" && operator === "<" && event.created_at < parseInt(value))
          continue;
        else if (key === "created_at" && operator === ">" && event.created_at > parseInt(value))
          continue;
        else
          return null;
      }
      let sighash = sha256$1(utf8Encoder.encode(`nostr:delegation:${event.pubkey}:${cond}`));
      if (!schnorr.verify(sig, sighash, pubkey))
        return null;
      return pubkey;
    }

    // nip27.ts
    var nip27_exports = {};
    __export(nip27_exports, {
      matchAll: () => matchAll,
      regex: () => regex,
      replaceAll: () => replaceAll
    });
    var regex = () => new RegExp(`\\b${NOSTR_URI_REGEX.source}\\b`, "g");
    function* matchAll(content) {
      const matches = content.matchAll(regex());
      for (const match of matches) {
        try {
          const [uri, value] = match;
          yield {
            uri,
            value,
            decoded: decode(value),
            start: match.index,
            end: match.index + uri.length
          };
        } catch (_e) {
        }
      }
    }
    function replaceAll(content, replacer) {
      return content.replaceAll(regex(), (uri, value) => {
        return replacer({
          uri,
          value,
          decoded: decode(value)
        });
      });
    }

    // nip28.ts
    var nip28_exports = {};
    __export(nip28_exports, {
      channelCreateEvent: () => channelCreateEvent,
      channelHideMessageEvent: () => channelHideMessageEvent,
      channelMessageEvent: () => channelMessageEvent,
      channelMetadataEvent: () => channelMetadataEvent,
      channelMuteUserEvent: () => channelMuteUserEvent
    });
    var channelCreateEvent = (t, privateKey) => {
      let content;
      if (typeof t.content === "object") {
        content = JSON.stringify(t.content);
      } else if (typeof t.content === "string") {
        content = t.content;
      } else {
        return void 0;
      }
      return finishEvent(
        {
          kind: 40 /* ChannelCreation */,
          tags: [...t.tags ?? []],
          content,
          created_at: t.created_at
        },
        privateKey
      );
    };
    var channelMetadataEvent = (t, privateKey) => {
      let content;
      if (typeof t.content === "object") {
        content = JSON.stringify(t.content);
      } else if (typeof t.content === "string") {
        content = t.content;
      } else {
        return void 0;
      }
      return finishEvent(
        {
          kind: 41 /* ChannelMetadata */,
          tags: [["e", t.channel_create_event_id], ...t.tags ?? []],
          content,
          created_at: t.created_at
        },
        privateKey
      );
    };
    var channelMessageEvent = (t, privateKey) => {
      const tags = [["e", t.channel_create_event_id, t.relay_url, "root"]];
      if (t.reply_to_channel_message_event_id) {
        tags.push(["e", t.reply_to_channel_message_event_id, t.relay_url, "reply"]);
      }
      return finishEvent(
        {
          kind: 42 /* ChannelMessage */,
          tags: [...tags, ...t.tags ?? []],
          content: t.content,
          created_at: t.created_at
        },
        privateKey
      );
    };
    var channelHideMessageEvent = (t, privateKey) => {
      let content;
      if (typeof t.content === "object") {
        content = JSON.stringify(t.content);
      } else if (typeof t.content === "string") {
        content = t.content;
      } else {
        return void 0;
      }
      return finishEvent(
        {
          kind: 43 /* ChannelHideMessage */,
          tags: [["e", t.channel_message_event_id], ...t.tags ?? []],
          content,
          created_at: t.created_at
        },
        privateKey
      );
    };
    var channelMuteUserEvent = (t, privateKey) => {
      let content;
      if (typeof t.content === "object") {
        content = JSON.stringify(t.content);
      } else if (typeof t.content === "string") {
        content = t.content;
      } else {
        return void 0;
      }
      return finishEvent(
        {
          kind: 44 /* ChannelMuteUser */,
          tags: [["p", t.pubkey_to_mute], ...t.tags ?? []],
          content,
          created_at: t.created_at
        },
        privateKey
      );
    };

    // nip39.ts
    var nip39_exports = {};
    __export(nip39_exports, {
      useFetchImplementation: () => useFetchImplementation2,
      validateGithub: () => validateGithub
    });
    var _fetch2;
    try {
      _fetch2 = fetch;
    } catch {
    }
    function useFetchImplementation2(fetchImplementation) {
      _fetch2 = fetchImplementation;
    }
    async function validateGithub(pubkey, username, proof) {
      try {
        let res = await (await _fetch2(`https://gist.github.com/${username}/${proof}/raw`)).text();
        return res === `Verifying that I control the following Nostr public key: ${pubkey}`;
      } catch (_) {
        return false;
      }
    }

    // nip42.ts
    var nip42_exports = {};
    __export(nip42_exports, {
      authenticate: () => authenticate
    });
    var authenticate = async ({
      challenge,
      relay,
      sign
    }) => {
      const e = {
        kind: 22242 /* ClientAuth */,
        created_at: Math.floor(Date.now() / 1e3),
        tags: [
          ["relay", relay.url],
          ["challenge", challenge]
        ],
        content: ""
      };
      return relay.auth(await sign(e));
    };

    // nip44.ts
    var nip44_exports = {};
    __export(nip44_exports, {
      decrypt: () => decrypt2,
      encrypt: () => encrypt2,
      utils: () => utils$1
    });
    var utils$1 = {
      v2: {
        maxPlaintextSize: 65536 - 128,
        minCiphertextSize: 100,
        maxCiphertextSize: 102400,
        getConversationKey(privkeyA, pubkeyB) {
          const key = secp256k1.getSharedSecret(privkeyA, "02" + pubkeyB);
          return key.subarray(1, 33);
        },
        getMessageKeys(conversationKey, salt) {
          const keys = hkdf(sha256$1, conversationKey, salt, "nip44-v2", 76);
          return {
            encryption: keys.subarray(0, 32),
            nonce: keys.subarray(32, 44),
            auth: keys.subarray(44, 76)
          };
        },
        calcPadding(len) {
          if (!Number.isSafeInteger(len) || len < 0)
            throw new Error("expected positive integer");
          if (len <= 32)
            return 32;
          const nextpower = 1 << Math.floor(Math.log2(len - 1)) + 1;
          const chunk = nextpower <= 256 ? 32 : nextpower / 8;
          return chunk * (Math.floor((len - 1) / chunk) + 1);
        },
        pad(unpadded) {
          const unpaddedB = utf8Encoder.encode(unpadded);
          const len = unpaddedB.length;
          if (len < 1 || len >= utils$1.v2.maxPlaintextSize)
            throw new Error("invalid plaintext length: must be between 1b and 64KB");
          const paddedLen = utils$1.v2.calcPadding(len);
          const zeros = new Uint8Array(paddedLen - len);
          const lenBuf = new Uint8Array(2);
          new DataView(lenBuf.buffer).setUint16(0, len);
          return concatBytes$1(lenBuf, unpaddedB, zeros);
        },
        unpad(padded) {
          const unpaddedLen = new DataView(padded.buffer).getUint16(0);
          const unpadded = padded.subarray(2, 2 + unpaddedLen);
          if (unpaddedLen === 0 || unpadded.length !== unpaddedLen || padded.length !== 2 + utils$1.v2.calcPadding(unpaddedLen))
            throw new Error("invalid padding");
          return utf8Decoder.decode(unpadded);
        }
      }
    };
    function encrypt2(key, plaintext, options = {}) {
      const version = options.version ?? 2;
      if (version !== 2)
        throw new Error("unknown encryption version " + version);
      const salt = options.salt ?? randomBytes$1(32);
      ensureBytes(salt, 32);
      const keys = utils$1.v2.getMessageKeys(key, salt);
      const padded = utils$1.v2.pad(plaintext);
      const ciphertext = chacha20(keys.encryption, keys.nonce, padded);
      const mac = hmac(sha256$1, keys.auth, ciphertext);
      return base64.encode(concatBytes$1(new Uint8Array([version]), salt, ciphertext, mac));
    }
    function decrypt2(key, ciphertext) {
      const u = utils$1.v2;
      ensureBytes(key, 32);
      const clen = ciphertext.length;
      if (clen < u.minCiphertextSize || clen >= u.maxCiphertextSize)
        throw new Error("invalid ciphertext length: " + clen);
      if (ciphertext[0] === "#")
        throw new Error("unknown encryption version");
      let data;
      try {
        data = base64.decode(ciphertext);
      } catch (error) {
        throw new Error("invalid base64: " + error.message);
      }
      const vers = data.subarray(0, 1)[0];
      if (vers !== 2)
        throw new Error("unknown encryption version " + vers);
      const salt = data.subarray(1, 33);
      const ciphertext_ = data.subarray(33, -32);
      const mac = data.subarray(-32);
      const keys = u.getMessageKeys(key, salt);
      const calculatedMac = hmac(sha256$1, keys.auth, ciphertext_);
      if (!equalBytes(calculatedMac, mac))
        throw new Error("invalid MAC");
      const padded = chacha20(keys.encryption, keys.nonce, ciphertext_);
      return u.unpad(padded);
    }

    // nip47.ts
    var nip47_exports = {};
    __export(nip47_exports, {
      makeNwcRequestEvent: () => makeNwcRequestEvent,
      parseConnectionString: () => parseConnectionString
    });
    function parseConnectionString(connectionString) {
      const { pathname, searchParams } = new URL(connectionString);
      const pubkey = pathname;
      const relay = searchParams.get("relay");
      const secret = searchParams.get("secret");
      if (!pubkey || !relay || !secret) {
        throw new Error("invalid connection string");
      }
      return { pubkey, relay, secret };
    }
    async function makeNwcRequestEvent({
      pubkey,
      secret,
      invoice
    }) {
      const content = {
        method: "pay_invoice",
        params: {
          invoice
        }
      };
      const encryptedContent = await encrypt$1(secret, pubkey, JSON.stringify(content));
      const eventTemplate = {
        kind: 23194 /* NwcRequest */,
        created_at: Math.round(Date.now() / 1e3),
        content: encryptedContent,
        tags: [["p", pubkey]]
      };
      return finishEvent(eventTemplate, secret);
    }

    // nip57.ts
    var nip57_exports = {};
    __export(nip57_exports, {
      getZapEndpoint: () => getZapEndpoint,
      makeZapReceipt: () => makeZapReceipt,
      makeZapRequest: () => makeZapRequest,
      useFetchImplementation: () => useFetchImplementation3,
      validateZapRequest: () => validateZapRequest
    });
    var _fetch3;
    try {
      _fetch3 = fetch;
    } catch {
    }
    function useFetchImplementation3(fetchImplementation) {
      _fetch3 = fetchImplementation;
    }
    async function getZapEndpoint(metadata) {
      try {
        let lnurl = "";
        let { lud06, lud16 } = JSON.parse(metadata.content);
        if (lud06) {
          let { words } = bech32$1.decode(lud06, 1e3);
          let data = bech32$1.fromWords(words);
          lnurl = utf8Decoder.decode(data);
        } else if (lud16) {
          let [name, domain] = lud16.split("@");
          lnurl = `https://${domain}/.well-known/lnurlp/${name}`;
        } else {
          return null;
        }
        let res = await _fetch3(lnurl);
        let body = await res.json();
        if (body.allowsNostr && body.nostrPubkey) {
          return body.callback;
        }
      } catch (err) {
      }
      return null;
    }
    function makeZapRequest({
      profile,
      event,
      amount,
      relays,
      comment = ""
    }) {
      if (!amount)
        throw new Error("amount not given");
      if (!profile)
        throw new Error("profile not given");
      let zr = {
        kind: 9734,
        created_at: Math.round(Date.now() / 1e3),
        content: comment,
        tags: [
          ["p", profile],
          ["amount", amount.toString()],
          ["relays", ...relays]
        ]
      };
      if (event) {
        zr.tags.push(["e", event]);
      }
      return zr;
    }
    function validateZapRequest(zapRequestString) {
      let zapRequest;
      try {
        zapRequest = JSON.parse(zapRequestString);
      } catch (err) {
        return "Invalid zap request JSON.";
      }
      if (!validateEvent(zapRequest))
        return "Zap request is not a valid Nostr event.";
      if (!verifySignature(zapRequest))
        return "Invalid signature on zap request.";
      let p = zapRequest.tags.find(([t, v]) => t === "p" && v);
      if (!p)
        return "Zap request doesn't have a 'p' tag.";
      if (!p[1].match(/^[a-f0-9]{64}$/))
        return "Zap request 'p' tag is not valid hex.";
      let e = zapRequest.tags.find(([t, v]) => t === "e" && v);
      if (e && !e[1].match(/^[a-f0-9]{64}$/))
        return "Zap request 'e' tag is not valid hex.";
      let relays = zapRequest.tags.find(([t, v]) => t === "relays" && v);
      if (!relays)
        return "Zap request doesn't have a 'relays' tag.";
      return null;
    }
    function makeZapReceipt({
      zapRequest,
      preimage,
      bolt11,
      paidAt
    }) {
      let zr = JSON.parse(zapRequest);
      let tagsFromZapRequest = zr.tags.filter(([t]) => t === "e" || t === "p" || t === "a");
      let zap = {
        kind: 9735,
        created_at: Math.round(paidAt.getTime() / 1e3),
        content: "",
        tags: [...tagsFromZapRequest, ["bolt11", bolt11], ["description", zapRequest]]
      };
      if (preimage) {
        zap.tags.push(["preimage", preimage]);
      }
      return zap;
    }

    // nip98.ts
    var nip98_exports = {};
    __export(nip98_exports, {
      getToken: () => getToken,
      unpackEventFromToken: () => unpackEventFromToken,
      validateEvent: () => validateEvent2,
      validateToken: () => validateToken
    });
    var _authorizationScheme = "Nostr ";
    async function getToken(loginUrl, httpMethod, sign, includeAuthorizationScheme = false) {
      if (!loginUrl || !httpMethod)
        throw new Error("Missing loginUrl or httpMethod");
      const event = getBlankEvent(27235 /* HttpAuth */);
      event.tags = [
        ["u", loginUrl],
        ["method", httpMethod]
      ];
      event.created_at = Math.round(new Date().getTime() / 1e3);
      const signedEvent = await sign(event);
      const authorizationScheme = includeAuthorizationScheme ? _authorizationScheme : "";
      return authorizationScheme + base64.encode(utf8Encoder.encode(JSON.stringify(signedEvent)));
    }
    async function validateToken(token, url, method) {
      const event = await unpackEventFromToken(token).catch((error) => {
        throw error;
      });
      const valid = await validateEvent2(event, url, method).catch((error) => {
        throw error;
      });
      return valid;
    }
    async function unpackEventFromToken(token) {
      if (!token) {
        throw new Error("Missing token");
      }
      token = token.replace(_authorizationScheme, "");
      const eventB64 = utf8Decoder.decode(base64.decode(token));
      if (!eventB64 || eventB64.length === 0 || !eventB64.startsWith("{")) {
        throw new Error("Invalid token");
      }
      const event = JSON.parse(eventB64);
      return event;
    }
    async function validateEvent2(event, url, method) {
      if (!event) {
        throw new Error("Invalid nostr event");
      }
      if (!verifySignature(event)) {
        throw new Error("Invalid nostr event, signature invalid");
      }
      if (event.kind !== 27235 /* HttpAuth */) {
        throw new Error("Invalid nostr event, kind invalid");
      }
      if (!event.created_at) {
        throw new Error("Invalid nostr event, created_at invalid");
      }
      if (Math.round(new Date().getTime() / 1e3) - event.created_at > 60) {
        throw new Error("Invalid nostr event, expired");
      }
      const urlTag = event.tags.find((t) => t[0] === "u");
      if (urlTag?.length !== 1 && urlTag?.[1] !== url) {
        throw new Error("Invalid nostr event, url tag invalid");
      }
      const methodTag = event.tags.find((t) => t[0] === "method");
      if (methodTag?.length !== 1 && methodTag?.[1].toLowerCase() !== method.toLowerCase()) {
        throw new Error("Invalid nostr event, method tag invalid");
      }
      return true;
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    var lib$1 = {};

    var types = {};

    Object.defineProperty(types, "__esModule", { value: true });

    var ee = {};

    var taskCollection$1 = {};

    var taskCollection = {};

    var bakeCollection = {};

    (function (exports) {
    	Object.defineProperty(exports, "__esModule", { value: true });
    	exports.bakeCollectionVariadic = exports.bakeCollectionAwait = exports.bakeCollection = exports.BAKED_EMPTY_FUNC = void 0;
    	exports.BAKED_EMPTY_FUNC = (function () { });
    	var FORLOOP_FALLBACK = 1500;
    	function generateArgsDefCode(numArgs) {
    	    var argsDefCode = '';
    	    if (numArgs === 0)
    	        return argsDefCode;
    	    for (var i = 0; i < numArgs - 1; ++i) {
    	        argsDefCode += ('arg' + String(i) + ', ');
    	    }
    	    argsDefCode += ('arg' + String(numArgs - 1));
    	    return argsDefCode;
    	}
    	function generateBodyPartsCode(argsDefCode, collectionLength) {
    	    var funcDefCode = '', funcCallCode = '';
    	    for (var i = 0; i < collectionLength; ++i) {
    	        funcDefCode += "var f".concat(i, " = collection[").concat(i, "];\n");
    	        funcCallCode += "f".concat(i, "(").concat(argsDefCode, ")\n");
    	    }
    	    return { funcDefCode: funcDefCode, funcCallCode: funcCallCode };
    	}
    	function generateBodyPartsVariadicCode(collectionLength) {
    	    var funcDefCode = '', funcCallCode = '';
    	    for (var i = 0; i < collectionLength; ++i) {
    	        funcDefCode += "var f".concat(i, " = collection[").concat(i, "];\n");
    	        funcCallCode += "f".concat(i, ".apply(undefined, arguments)\n");
    	    }
    	    return { funcDefCode: funcDefCode, funcCallCode: funcCallCode };
    	}
    	function bakeCollection(collection, fixedArgsNum) {
    	    if (collection.length === 0)
    	        return exports.BAKED_EMPTY_FUNC;
    	    else if (collection.length === 1)
    	        return collection[0];
    	    var funcFactoryCode;
    	    if (collection.length < FORLOOP_FALLBACK) {
    	        var argsDefCode = generateArgsDefCode(fixedArgsNum);
    	        var _a = generateBodyPartsCode(argsDefCode, collection.length), funcDefCode = _a.funcDefCode, funcCallCode = _a.funcCallCode;
    	        funcFactoryCode = "(function(collection) {\n            ".concat(funcDefCode, "\n            collection = undefined;\n            return (function(").concat(argsDefCode, ") {\n                ").concat(funcCallCode, "\n            });\n        })");
    	    }
    	    else {
    	        var argsDefCode = generateArgsDefCode(fixedArgsNum);
    	        // loop unroll
    	        if (collection.length % 10 === 0) {
    	            funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; i += 10) {\n                        collection[i](").concat(argsDefCode, ");\n                        collection[i+1](").concat(argsDefCode, ");\n                        collection[i+2](").concat(argsDefCode, ");\n                        collection[i+3](").concat(argsDefCode, ");\n                        collection[i+4](").concat(argsDefCode, ");\n                        collection[i+5](").concat(argsDefCode, ");\n                        collection[i+6](").concat(argsDefCode, ");\n                        collection[i+7](").concat(argsDefCode, ");\n                        collection[i+8](").concat(argsDefCode, ");\n                        collection[i+9](").concat(argsDefCode, ");\n                    }\n                });\n            })");
    	        }
    	        else if (collection.length % 4 === 0) {
    	            funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; i += 4) {\n                        collection[i](").concat(argsDefCode, ");\n                        collection[i+1](").concat(argsDefCode, ");\n                        collection[i+2](").concat(argsDefCode, ");\n                        collection[i+3](").concat(argsDefCode, ");\n                    }\n                });\n            })");
    	        }
    	        else if (collection.length % 3 === 0) {
    	            funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; i += 3) {\n                        collection[i](").concat(argsDefCode, ");\n                        collection[i+1](").concat(argsDefCode, ");\n                        collection[i+2](").concat(argsDefCode, ");\n                    }\n                });\n            })");
    	        }
    	        else {
    	            funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; ++i) {\n                        collection[i](").concat(argsDefCode, ");\n                    }\n                });\n            })");
    	        }
    	    }
    	    {
    	        var funcFactory = eval(funcFactoryCode);
    	        return funcFactory(collection);
    	    }
    	}
    	exports.bakeCollection = bakeCollection;
    	function bakeCollectionAwait(collection, fixedArgsNum) {
    	    if (collection.length === 0)
    	        return exports.BAKED_EMPTY_FUNC;
    	    else if (collection.length === 1)
    	        return collection[0];
    	    var funcFactoryCode;
    	    if (collection.length < FORLOOP_FALLBACK) {
    	        var argsDefCode = generateArgsDefCode(fixedArgsNum);
    	        var _a = generateBodyPartsCode(argsDefCode, collection.length), funcDefCode = _a.funcDefCode, funcCallCode = _a.funcCallCode;
    	        funcFactoryCode = "(function(collection) {\n            ".concat(funcDefCode, "\n            collection = undefined;\n            return (function(").concat(argsDefCode, ") {\n                return Promise.all([ ").concat(funcCallCode, " ]);\n            });\n        })");
    	    }
    	    else {
    	        var argsDefCode = generateArgsDefCode(fixedArgsNum);
    	        funcFactoryCode = "(function(collection) {\n            return (function(".concat(argsDefCode, ") {\n                var promises = Array(collection.length);\n                for (var i = 0; i < collection.length; ++i) {\n                    promises[i] = collection[i](").concat(argsDefCode, ");\n                }\n                return Promise.all(promises);\n            });\n        })");
    	    }
    	    {
    	        var funcFactory = eval(funcFactoryCode);
    	        return funcFactory(collection);
    	    }
    	}
    	exports.bakeCollectionAwait = bakeCollectionAwait;
    	function bakeCollectionVariadic(collection) {
    	    if (collection.length === 0)
    	        return exports.BAKED_EMPTY_FUNC;
    	    else if (collection.length === 1)
    	        return collection[0];
    	    var funcFactoryCode;
    	    if (collection.length < FORLOOP_FALLBACK) {
    	        var _a = generateBodyPartsVariadicCode(collection.length), funcDefCode = _a.funcDefCode, funcCallCode = _a.funcCallCode;
    	        funcFactoryCode = "(function(collection) {\n            ".concat(funcDefCode, "\n            collection = undefined;\n            return (function() {\n                ").concat(funcCallCode, "\n            });\n        })");
    	    }
    	    else {
    	        funcFactoryCode = "(function(collection) {\n            return (function() {\n                for (var i = 0; i < collection.length; ++i) {\n                    collection[i].apply(undefined, arguments);\n                }\n            });\n        })";
    	    }
    	    {
    	        var funcFactory = eval(funcFactoryCode);
    	        return funcFactory(collection);
    	    }
    	}
    	exports.bakeCollectionVariadic = bakeCollectionVariadic;
    	
    } (bakeCollection));

    var __spreadArray$1 = (commonjsGlobal && commonjsGlobal.__spreadArray) || function (to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    };
    Object.defineProperty(taskCollection, "__esModule", { value: true });
    taskCollection.TaskCollection = taskCollection._fast_remove_single = void 0;
    var bake_collection_1 = bakeCollection;
    function push_norebuild(a, b /*, ...func: Func[] */) {
        var len = this.length;
        if (len > 1) { // tasks is array
            if (b) { // if multiple args
                var _a;
                (_a = this._tasks).push.apply(_a, arguments);
                this.length += arguments.length;
            }
            else { // if single arg (most often case)
                this._tasks.push(a);
                this.length++;
            }
        }
        else { // tasks is (function or null)
            if (b) { // if multiple args
                if (len === 1) { // if this._tasks is function
                    var newAr = Array(1 + arguments.length);
                    newAr.push(newAr);
                    newAr.push.apply(newAr, arguments);
                    this._tasks = newAr;
                }
                else {
                    var newAr = Array(arguments.length);
                    newAr.push.apply(newAr, arguments);
                    this._tasks = newAr;
                }
                this.length += arguments.length;
            }
            else { // if single arg (most often case)
                if (len === 1)
                    this._tasks = [this._tasks, a];
                else
                    this._tasks = a;
                this.length++;
            }
        }
    }
    function push_rebuild(a, b /*, ...func: Func[] */) {
        var len = this.length;
        if (len > 1) { // tasks is array
            if (b) { // if multiple args
                var _a;
                (_a = this._tasks).push.apply(_a, arguments);
                this.length += arguments.length;
            }
            else { // if single arg (most often case)
                this._tasks.push(a);
                this.length++;
            }
        }
        else { // tasks is (function or null)
            if (b) { // if multiple args
                if (len === 1) { // if this._tasks is function
                    var newAr = Array(1 + arguments.length);
                    newAr.push(newAr);
                    newAr.push.apply(newAr, arguments);
                    this._tasks = newAr;
                }
                else {
                    var newAr = Array(arguments.length);
                    newAr.push.apply(newAr, arguments);
                    this._tasks = newAr;
                }
                this.length += arguments.length;
            }
            else { // if single arg (most often case)
                if (len === 1)
                    this._tasks = [this._tasks, a];
                else
                    this._tasks = a;
                this.length++;
            }
        }
        if (this.firstEmitBuildStrategy)
            this.call = rebuild_on_first_call;
        else
            this.rebuild();
    }
    function _fast_remove_single(arr, index) {
        if (index === -1)
            return;
        if (index === 0)
            arr.shift();
        else if (index === arr.length - 1)
            arr.length = arr.length - 1;
        else
            arr.splice(index, 1);
    }
    taskCollection._fast_remove_single = _fast_remove_single;
    function removeLast_norebuild(a) {
        if (this.length === 0)
            return;
        if (this.length === 1) {
            if (this._tasks === a) {
                this.length = 0;
            }
        }
        else {
            _fast_remove_single(this._tasks, this._tasks.lastIndexOf(a));
            if (this._tasks.length === 1) {
                this._tasks = this._tasks[0];
                this.length = 1;
            }
            else
                this.length = this._tasks.length;
        }
    }
    function removeLast_rebuild(a) {
        if (this.length === 0)
            return;
        if (this.length === 1) {
            if (this._tasks === a) {
                this.length = 0;
            }
            if (this.firstEmitBuildStrategy) {
                this.call = bake_collection_1.BAKED_EMPTY_FUNC;
                return;
            }
            else {
                this.rebuild();
                return;
            }
        }
        else {
            _fast_remove_single(this._tasks, this._tasks.lastIndexOf(a));
            if (this._tasks.length === 1) {
                this._tasks = this._tasks[0];
                this.length = 1;
            }
            else
                this.length = this._tasks.length;
        }
        if (this.firstEmitBuildStrategy)
            this.call = rebuild_on_first_call;
        else
            this.rebuild();
    }
    function insert_norebuild(index) {
        var _b;
        var func = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            func[_i - 1] = arguments[_i];
        }
        if (this.length === 0) {
            this._tasks = func;
            this.length = 1;
        }
        else if (this.length === 1) {
            func.unshift(this._tasks);
            this._tasks = func;
            this.length = this._tasks.length;
        }
        else {
            (_b = this._tasks).splice.apply(_b, __spreadArray$1([index, 0], func, false));
            this.length = this._tasks.length;
        }
    }
    function insert_rebuild(index) {
        var _b;
        var func = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            func[_i - 1] = arguments[_i];
        }
        if (this.length === 0) {
            this._tasks = func;
            this.length = 1;
        }
        else if (this.length === 1) {
            func.unshift(this._tasks);
            this._tasks = func;
            this.length = this._tasks.length;
        }
        else {
            (_b = this._tasks).splice.apply(_b, __spreadArray$1([index, 0], func, false));
            this.length = this._tasks.length;
        }
        if (this.firstEmitBuildStrategy)
            this.call = rebuild_on_first_call;
        else
            this.rebuild();
    }
    function rebuild_noawait() {
        if (this.length === 0)
            this.call = bake_collection_1.BAKED_EMPTY_FUNC;
        else if (this.length === 1)
            this.call = this._tasks;
        else
            this.call = (0, bake_collection_1.bakeCollection)(this._tasks, this.argsNum);
    }
    function rebuild_await() {
        if (this.length === 0)
            this.call = bake_collection_1.BAKED_EMPTY_FUNC;
        else if (this.length === 1)
            this.call = this._tasks;
        else
            this.call = (0, bake_collection_1.bakeCollectionAwait)(this._tasks, this.argsNum);
    }
    function rebuild_on_first_call() {
        this.rebuild();
        this.call.apply(undefined, arguments);
    }
    var TaskCollection = /** @class */ (function () {
        function TaskCollection(argsNum, autoRebuild, initialTasks, awaitTasks) {
            if (autoRebuild === void 0) { autoRebuild = true; }
            if (initialTasks === void 0) { initialTasks = null; }
            if (awaitTasks === void 0) { awaitTasks = false; }
            this.awaitTasks = awaitTasks;
            this.call = bake_collection_1.BAKED_EMPTY_FUNC;
            this.argsNum = argsNum;
            this.firstEmitBuildStrategy = true;
            if (awaitTasks)
                this.rebuild = rebuild_await.bind(this);
            else
                this.rebuild = rebuild_noawait.bind(this);
            this.setAutoRebuild(autoRebuild);
            if (initialTasks) {
                if (typeof initialTasks === 'function') {
                    this._tasks = initialTasks;
                    this.length = 1;
                }
                else {
                    this._tasks = initialTasks;
                    this.length = initialTasks.length;
                }
            }
            else {
                this._tasks = null;
                this.length = 0;
            }
            if (autoRebuild)
                this.rebuild();
        }
        return TaskCollection;
    }());
    taskCollection.TaskCollection = TaskCollection;
    function fastClear() {
        this._tasks = null;
        this.length = 0;
        this.call = bake_collection_1.BAKED_EMPTY_FUNC;
    }
    function clear() {
        this._tasks = null;
        this.length = 0;
        this.call = bake_collection_1.BAKED_EMPTY_FUNC;
    }
    function growArgsNum(argsNum) {
        if (this.argsNum < argsNum) {
            this.argsNum = argsNum;
            if (this.firstEmitBuildStrategy)
                this.call = rebuild_on_first_call;
            else
                this.rebuild();
        }
    }
    function setAutoRebuild(newVal) {
        if (newVal) {
            this.push = push_rebuild.bind(this);
            this.insert = insert_rebuild.bind(this);
            this.removeLast = removeLast_rebuild.bind(this);
        }
        else {
            this.push = push_norebuild.bind(this);
            this.insert = insert_norebuild.bind(this);
            this.removeLast = removeLast_norebuild.bind(this);
        }
    }
    function tasksAsArray() {
        if (this.length === 0)
            return [];
        if (this.length === 1)
            return [this._tasks];
        return this._tasks;
    }
    function setTasks(tasks) {
        if (tasks.length === 0) {
            this.length = 0;
            this.call = bake_collection_1.BAKED_EMPTY_FUNC;
        }
        else if (tasks.length === 1) {
            this.length = 1;
            this.call = tasks[0];
            this._tasks = tasks[0];
        }
        else {
            this.length = tasks.length;
            this._tasks = tasks;
            if (this.firstEmitBuildStrategy)
                this.call = rebuild_on_first_call;
            else
                this.rebuild();
        }
    }
    TaskCollection.prototype.fastClear = fastClear;
    TaskCollection.prototype.clear = clear;
    TaskCollection.prototype.growArgsNum = growArgsNum;
    TaskCollection.prototype.setAutoRebuild = setAutoRebuild;
    TaskCollection.prototype.tasksAsArray = tasksAsArray;
    TaskCollection.prototype.setTasks = setTasks;

    (function (exports) {
    	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    var desc = Object.getOwnPropertyDescriptor(m, k);
    	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    	      desc = { enumerable: true, get: function() { return m[k]; } };
    	    }
    	    Object.defineProperty(o, k2, desc);
    	}) : (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    o[k2] = m[k];
    	}));
    	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
    	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    	};
    	Object.defineProperty(exports, "__esModule", { value: true });
    	__exportStar(taskCollection, exports);
    	
    } (taskCollection$1));

    var utils = {};

    Object.defineProperty(utils, "__esModule", { value: true });
    utils.nullObj = void 0;
    function nullObj() {
        var x = {};
        x.__proto__ = null;
        x.prototype = null;
        return x;
    }
    utils.nullObj = nullObj;

    var __spreadArray = (commonjsGlobal && commonjsGlobal.__spreadArray) || function (to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    };
    Object.defineProperty(ee, "__esModule", { value: true });
    ee.EventEmitter = void 0;
    var task_collection_1 = taskCollection$1;
    var utils_1 = utils;
    function emit(event, a, b, c, d, e) {
        var ev = this.events[event];
        if (ev) {
            if (ev.length === 0)
                return false;
            if (ev.argsNum < 6) {
                ev.call(a, b, c, d, e);
            }
            else {
                ev.call.apply(undefined, arguments);
            }
            return true;
        }
        return false;
    }
    function emitHasOnce(event, a, b, c, d, e) {
        var ev = this.events[event];
        if (ev) {
            if (ev.length === 0)
                return false;
            if (ev.argsNum < 6) {
                ev.call(a, b, c, d, e);
            }
            else {
                ev.call.apply(undefined, arguments);
            }
        }
        var oev = this.onceEvents[event];
        if (oev) {
            if (typeof oev === 'function') {
                this.onceEvents[event] = undefined;
                if (arguments.length < 6) {
                    oev(a, b, c, d, e);
                }
                else {
                    oev.apply(undefined, arguments);
                }
            }
            else {
                var fncs = oev;
                this.onceEvents[event] = undefined;
                if (arguments.length < 6) {
                    for (var i = 0; i < fncs.length; ++i)
                        fncs[i](a, b, c, d, e);
                }
                else {
                    for (var i = 0; i < fncs.length; ++i)
                        fncs[i].apply(undefined, arguments);
                }
            }
            return true;
        }
        return !!ev;
    }
    /** Implemented event emitter */
    var EventEmitter = /** @class */ (function () {
        function EventEmitter() {
            this.events = (0, utils_1.nullObj)();
            this.onceEvents = (0, utils_1.nullObj)();
            this._symbolKeys = new Set;
            this.maxListeners = Infinity;
        }
        Object.defineProperty(EventEmitter.prototype, "_eventsCount", {
            get: function () {
                return this.eventNames().length;
            },
            enumerable: false,
            configurable: true
        });
        return EventEmitter;
    }());
    ee.EventEmitter = EventEmitter;
    function once(event, listener) {
        if (this.emit === emit) {
            this.emit = emitHasOnce;
        }
        switch (typeof this.onceEvents[event]) {
            case 'undefined':
                this.onceEvents[event] = listener;
                if (typeof event === 'symbol')
                    this._symbolKeys.add(event);
                break;
            case 'function':
                this.onceEvents[event] = [this.onceEvents[event], listener];
                break;
            case 'object':
                this.onceEvents[event].push(listener);
        }
        return this;
    }
    function addListener(event, listener, argsNum) {
        if (argsNum === void 0) { argsNum = listener.length; }
        if (typeof listener !== 'function')
            throw new TypeError('The listener must be a function');
        var evtmap = this.events[event];
        if (!evtmap) {
            this.events[event] = new task_collection_1.TaskCollection(argsNum, true, listener, false);
            if (typeof event === 'symbol')
                this._symbolKeys.add(event);
        }
        else {
            evtmap.push(listener);
            evtmap.growArgsNum(argsNum);
            if (this.maxListeners !== Infinity && this.maxListeners <= evtmap.length)
                console.warn("Maximum event listeners for \"".concat(String(event), "\" event!"));
        }
        return this;
    }
    function removeListener(event, listener) {
        var evt = this.events[event];
        if (evt) {
            evt.removeLast(listener);
        }
        var evto = this.onceEvents[event];
        if (evto) {
            if (typeof evto === 'function') {
                this.onceEvents[event] = undefined;
            }
            else if (typeof evto === 'object') {
                if (evto.length === 1 && evto[0] === listener) {
                    this.onceEvents[event] = undefined;
                }
                else {
                    (0, task_collection_1._fast_remove_single)(evto, evto.lastIndexOf(listener));
                }
            }
        }
        return this;
    }
    function addListenerBound(event, listener, bindTo, argsNum) {
        if (bindTo === void 0) { bindTo = this; }
        if (argsNum === void 0) { argsNum = listener.length; }
        if (!this.boundFuncs)
            this.boundFuncs = new Map;
        var bound = listener.bind(bindTo);
        this.boundFuncs.set(listener, bound);
        return this.addListener(event, bound, argsNum);
    }
    function removeListenerBound(event, listener) {
        var _a, _b;
        var bound = (_a = this.boundFuncs) === null || _a === void 0 ? void 0 : _a.get(listener);
        (_b = this.boundFuncs) === null || _b === void 0 ? void 0 : _b.delete(listener);
        return this.removeListener(event, bound);
    }
    function hasListeners(event) {
        return this.events[event] && !!this.events[event].length;
    }
    function prependListener(event, listener, argsNum) {
        if (argsNum === void 0) { argsNum = listener.length; }
        if (typeof listener !== 'function')
            throw new TypeError('The listener must be a function');
        var evtmap = this.events[event];
        if (!evtmap || !(evtmap instanceof task_collection_1.TaskCollection)) {
            evtmap = this.events[event] = new task_collection_1.TaskCollection(argsNum, true, listener, false);
            if (typeof event === 'symbol')
                this._symbolKeys.add(event);
        }
        else {
            evtmap.insert(0, listener);
            evtmap.growArgsNum(argsNum);
            if (this.maxListeners !== Infinity && this.maxListeners <= evtmap.length)
                console.warn("Maximum event listeners for \"".concat(String(event), "\" event!"));
        }
        return this;
    }
    function prependOnceListener(event, listener) {
        if (this.emit === emit) {
            this.emit = emitHasOnce;
        }
        var evtmap = this.onceEvents[event];
        if (!evtmap || typeof evtmap !== 'object') {
            evtmap = this.onceEvents[event] = [listener];
            if (typeof event === 'symbol')
                this._symbolKeys.add(event);
        }
        else {
            // FIXME:
            throw new Error('FIXME');
        }
        return this;
    }
    function removeAllListeners(event) {
        if (event === undefined) {
            this.events = (0, utils_1.nullObj)();
            this.onceEvents = (0, utils_1.nullObj)();
            this._symbolKeys = new Set;
        }
        else {
            this.events[event] = undefined;
            this.onceEvents[event] = undefined;
            if (typeof event === 'symbol')
                this._symbolKeys.delete(event);
        }
        return this;
    }
    function setMaxListeners(n) {
        this.maxListeners = n;
        return this;
    }
    function getMaxListeners() {
        return this.maxListeners;
    }
    function listeners(event) {
        if (this.emit === emit)
            return this.events[event] ? this.events[event].tasksAsArray().slice() : [];
        else {
            if (this.events[event] && this.onceEvents[event]) {
                return __spreadArray(__spreadArray([], this.events[event].tasksAsArray(), true), (typeof this.onceEvents[event] === 'function' ? [this.onceEvents[event]] : this.onceEvents[event]), true);
            }
            else if (this.events[event])
                return this.events[event].tasksAsArray();
            else if (this.onceEvents[event])
                return (typeof this.onceEvents[event] === 'function' ? [this.onceEvents[event]] : this.onceEvents[event]);
            else
                return [];
        }
    }
    function eventNames() {
        var _this = this;
        if (this.emit === emit) {
            var keys = Object.keys(this.events);
            return __spreadArray(__spreadArray([], keys, true), Array.from(this._symbolKeys), true).filter(function (x) { return (x in _this.events) && _this.events[x] && _this.events[x].length; });
        }
        else {
            var keys = Object.keys(this.events).filter(function (x) { return _this.events[x] && _this.events[x].length; });
            var keysO = Object.keys(this.onceEvents).filter(function (x) { return _this.onceEvents[x] && _this.onceEvents[x].length; });
            return __spreadArray(__spreadArray(__spreadArray([], keys, true), keysO, true), Array.from(this._symbolKeys).filter(function (x) { return (((x in _this.events) && _this.events[x] && _this.events[x].length) ||
                ((x in _this.onceEvents) && _this.onceEvents[x] && _this.onceEvents[x].length)); }), true);
        }
    }
    function listenerCount(type) {
        if (this.emit === emit)
            return this.events[type] && this.events[type].length || 0;
        else
            return (this.events[type] && this.events[type].length || 0) + (this.onceEvents[type] && this.onceEvents[type].length || 0);
    }
    EventEmitter.prototype.emit = emit;
    EventEmitter.prototype.on = addListener;
    EventEmitter.prototype.once = once;
    EventEmitter.prototype.addListener = addListener;
    EventEmitter.prototype.removeListener = removeListener;
    EventEmitter.prototype.addListenerBound = addListenerBound;
    EventEmitter.prototype.removeListenerBound = removeListenerBound;
    EventEmitter.prototype.hasListeners = hasListeners;
    EventEmitter.prototype.prependListener = prependListener;
    EventEmitter.prototype.prependOnceListener = prependOnceListener;
    EventEmitter.prototype.off = removeListener;
    EventEmitter.prototype.removeAllListeners = removeAllListeners;
    EventEmitter.prototype.setMaxListeners = setMaxListeners;
    EventEmitter.prototype.getMaxListeners = getMaxListeners;
    EventEmitter.prototype.listeners = listeners;
    EventEmitter.prototype.eventNames = eventNames;
    EventEmitter.prototype.listenerCount = listenerCount;

    (function (exports) {
    	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    var desc = Object.getOwnPropertyDescriptor(m, k);
    	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    	      desc = { enumerable: true, get: function() { return m[k]; } };
    	    }
    	    Object.defineProperty(o, k2, desc);
    	}) : (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    o[k2] = m[k];
    	}));
    	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
    	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    	};
    	Object.defineProperty(exports, "__esModule", { value: true });
    	__exportStar(types, exports);
    	__exportStar(ee, exports);
    	
    } (lib$1));

    var browser = {exports: {}};

    /**
     * Helpers.
     */

    var ms;
    var hasRequiredMs;

    function requireMs () {
    	if (hasRequiredMs) return ms;
    	hasRequiredMs = 1;
    	var s = 1000;
    	var m = s * 60;
    	var h = m * 60;
    	var d = h * 24;
    	var w = d * 7;
    	var y = d * 365.25;

    	/**
    	 * Parse or format the given `val`.
    	 *
    	 * Options:
    	 *
    	 *  - `long` verbose formatting [false]
    	 *
    	 * @param {String|Number} val
    	 * @param {Object} [options]
    	 * @throws {Error} throw an error if val is not a non-empty string or a number
    	 * @return {String|Number}
    	 * @api public
    	 */

    	ms = function(val, options) {
    	  options = options || {};
    	  var type = typeof val;
    	  if (type === 'string' && val.length > 0) {
    	    return parse(val);
    	  } else if (type === 'number' && isFinite(val)) {
    	    return options.long ? fmtLong(val) : fmtShort(val);
    	  }
    	  throw new Error(
    	    'val is not a non-empty string or a valid number. val=' +
    	      JSON.stringify(val)
    	  );
    	};

    	/**
    	 * Parse the given `str` and return milliseconds.
    	 *
    	 * @param {String} str
    	 * @return {Number}
    	 * @api private
    	 */

    	function parse(str) {
    	  str = String(str);
    	  if (str.length > 100) {
    	    return;
    	  }
    	  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    	    str
    	  );
    	  if (!match) {
    	    return;
    	  }
    	  var n = parseFloat(match[1]);
    	  var type = (match[2] || 'ms').toLowerCase();
    	  switch (type) {
    	    case 'years':
    	    case 'year':
    	    case 'yrs':
    	    case 'yr':
    	    case 'y':
    	      return n * y;
    	    case 'weeks':
    	    case 'week':
    	    case 'w':
    	      return n * w;
    	    case 'days':
    	    case 'day':
    	    case 'd':
    	      return n * d;
    	    case 'hours':
    	    case 'hour':
    	    case 'hrs':
    	    case 'hr':
    	    case 'h':
    	      return n * h;
    	    case 'minutes':
    	    case 'minute':
    	    case 'mins':
    	    case 'min':
    	    case 'm':
    	      return n * m;
    	    case 'seconds':
    	    case 'second':
    	    case 'secs':
    	    case 'sec':
    	    case 's':
    	      return n * s;
    	    case 'milliseconds':
    	    case 'millisecond':
    	    case 'msecs':
    	    case 'msec':
    	    case 'ms':
    	      return n;
    	    default:
    	      return undefined;
    	  }
    	}

    	/**
    	 * Short format for `ms`.
    	 *
    	 * @param {Number} ms
    	 * @return {String}
    	 * @api private
    	 */

    	function fmtShort(ms) {
    	  var msAbs = Math.abs(ms);
    	  if (msAbs >= d) {
    	    return Math.round(ms / d) + 'd';
    	  }
    	  if (msAbs >= h) {
    	    return Math.round(ms / h) + 'h';
    	  }
    	  if (msAbs >= m) {
    	    return Math.round(ms / m) + 'm';
    	  }
    	  if (msAbs >= s) {
    	    return Math.round(ms / s) + 's';
    	  }
    	  return ms + 'ms';
    	}

    	/**
    	 * Long format for `ms`.
    	 *
    	 * @param {Number} ms
    	 * @return {String}
    	 * @api private
    	 */

    	function fmtLong(ms) {
    	  var msAbs = Math.abs(ms);
    	  if (msAbs >= d) {
    	    return plural(ms, msAbs, d, 'day');
    	  }
    	  if (msAbs >= h) {
    	    return plural(ms, msAbs, h, 'hour');
    	  }
    	  if (msAbs >= m) {
    	    return plural(ms, msAbs, m, 'minute');
    	  }
    	  if (msAbs >= s) {
    	    return plural(ms, msAbs, s, 'second');
    	  }
    	  return ms + ' ms';
    	}

    	/**
    	 * Pluralization helper.
    	 */

    	function plural(ms, msAbs, n, name) {
    	  var isPlural = msAbs >= n * 1.5;
    	  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
    	}
    	return ms;
    }

    /**
     * This is the common logic for both the Node.js and web browser
     * implementations of `debug()`.
     */

    function setup(env) {
    	createDebug.debug = createDebug;
    	createDebug.default = createDebug;
    	createDebug.coerce = coerce;
    	createDebug.disable = disable;
    	createDebug.enable = enable;
    	createDebug.enabled = enabled;
    	createDebug.humanize = requireMs();
    	createDebug.destroy = destroy;

    	Object.keys(env).forEach(key => {
    		createDebug[key] = env[key];
    	});

    	/**
    	* The currently active debug mode names, and names to skip.
    	*/

    	createDebug.names = [];
    	createDebug.skips = [];

    	/**
    	* Map of special "%n" handling functions, for the debug "format" argument.
    	*
    	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
    	*/
    	createDebug.formatters = {};

    	/**
    	* Selects a color for a debug namespace
    	* @param {String} namespace The namespace string for the debug instance to be colored
    	* @return {Number|String} An ANSI color code for the given namespace
    	* @api private
    	*/
    	function selectColor(namespace) {
    		let hash = 0;

    		for (let i = 0; i < namespace.length; i++) {
    			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
    			hash |= 0; // Convert to 32bit integer
    		}

    		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    	}
    	createDebug.selectColor = selectColor;

    	/**
    	* Create a debugger with the given `namespace`.
    	*
    	* @param {String} namespace
    	* @return {Function}
    	* @api public
    	*/
    	function createDebug(namespace) {
    		let prevTime;
    		let enableOverride = null;
    		let namespacesCache;
    		let enabledCache;

    		function debug(...args) {
    			// Disabled?
    			if (!debug.enabled) {
    				return;
    			}

    			const self = debug;

    			// Set `diff` timestamp
    			const curr = Number(new Date());
    			const ms = curr - (prevTime || curr);
    			self.diff = ms;
    			self.prev = prevTime;
    			self.curr = curr;
    			prevTime = curr;

    			args[0] = createDebug.coerce(args[0]);

    			if (typeof args[0] !== 'string') {
    				// Anything else let's inspect with %O
    				args.unshift('%O');
    			}

    			// Apply any `formatters` transformations
    			let index = 0;
    			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
    				// If we encounter an escaped % then don't increase the array index
    				if (match === '%%') {
    					return '%';
    				}
    				index++;
    				const formatter = createDebug.formatters[format];
    				if (typeof formatter === 'function') {
    					const val = args[index];
    					match = formatter.call(self, val);

    					// Now we need to remove `args[index]` since it's inlined in the `format`
    					args.splice(index, 1);
    					index--;
    				}
    				return match;
    			});

    			// Apply env-specific formatting (colors, etc.)
    			createDebug.formatArgs.call(self, args);

    			const logFn = self.log || createDebug.log;
    			logFn.apply(self, args);
    		}

    		debug.namespace = namespace;
    		debug.useColors = createDebug.useColors();
    		debug.color = createDebug.selectColor(namespace);
    		debug.extend = extend;
    		debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

    		Object.defineProperty(debug, 'enabled', {
    			enumerable: true,
    			configurable: false,
    			get: () => {
    				if (enableOverride !== null) {
    					return enableOverride;
    				}
    				if (namespacesCache !== createDebug.namespaces) {
    					namespacesCache = createDebug.namespaces;
    					enabledCache = createDebug.enabled(namespace);
    				}

    				return enabledCache;
    			},
    			set: v => {
    				enableOverride = v;
    			}
    		});

    		// Env-specific initialization logic for debug instances
    		if (typeof createDebug.init === 'function') {
    			createDebug.init(debug);
    		}

    		return debug;
    	}

    	function extend(namespace, delimiter) {
    		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
    		newDebug.log = this.log;
    		return newDebug;
    	}

    	/**
    	* Enables a debug mode by namespaces. This can include modes
    	* separated by a colon and wildcards.
    	*
    	* @param {String} namespaces
    	* @api public
    	*/
    	function enable(namespaces) {
    		createDebug.save(namespaces);
    		createDebug.namespaces = namespaces;

    		createDebug.names = [];
    		createDebug.skips = [];

    		let i;
    		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
    		const len = split.length;

    		for (i = 0; i < len; i++) {
    			if (!split[i]) {
    				// ignore empty strings
    				continue;
    			}

    			namespaces = split[i].replace(/\*/g, '.*?');

    			if (namespaces[0] === '-') {
    				createDebug.skips.push(new RegExp('^' + namespaces.slice(1) + '$'));
    			} else {
    				createDebug.names.push(new RegExp('^' + namespaces + '$'));
    			}
    		}
    	}

    	/**
    	* Disable debug output.
    	*
    	* @return {String} namespaces
    	* @api public
    	*/
    	function disable() {
    		const namespaces = [
    			...createDebug.names.map(toNamespace),
    			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
    		].join(',');
    		createDebug.enable('');
    		return namespaces;
    	}

    	/**
    	* Returns true if the given mode name is enabled, false otherwise.
    	*
    	* @param {String} name
    	* @return {Boolean}
    	* @api public
    	*/
    	function enabled(name) {
    		if (name[name.length - 1] === '*') {
    			return true;
    		}

    		let i;
    		let len;

    		for (i = 0, len = createDebug.skips.length; i < len; i++) {
    			if (createDebug.skips[i].test(name)) {
    				return false;
    			}
    		}

    		for (i = 0, len = createDebug.names.length; i < len; i++) {
    			if (createDebug.names[i].test(name)) {
    				return true;
    			}
    		}

    		return false;
    	}

    	/**
    	* Convert regexp to namespace
    	*
    	* @param {RegExp} regxep
    	* @return {String} namespace
    	* @api private
    	*/
    	function toNamespace(regexp) {
    		return regexp.toString()
    			.substring(2, regexp.toString().length - 2)
    			.replace(/\.\*\?$/, '*');
    	}

    	/**
    	* Coerce `val`.
    	*
    	* @param {Mixed} val
    	* @return {Mixed}
    	* @api private
    	*/
    	function coerce(val) {
    		if (val instanceof Error) {
    			return val.stack || val.message;
    		}
    		return val;
    	}

    	/**
    	* XXX DO NOT USE. This is a temporary stub function.
    	* XXX It WILL be removed in the next major release.
    	*/
    	function destroy() {
    		console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    	}

    	createDebug.enable(createDebug.load());

    	return createDebug;
    }

    var common = setup;

    /* eslint-env browser */

    (function (module, exports) {
    	/**
    	 * This is the web browser implementation of `debug()`.
    	 */

    	exports.formatArgs = formatArgs;
    	exports.save = save;
    	exports.load = load;
    	exports.useColors = useColors;
    	exports.storage = localstorage();
    	exports.destroy = (() => {
    		let warned = false;

    		return () => {
    			if (!warned) {
    				warned = true;
    				console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    			}
    		};
    	})();

    	/**
    	 * Colors.
    	 */

    	exports.colors = [
    		'#0000CC',
    		'#0000FF',
    		'#0033CC',
    		'#0033FF',
    		'#0066CC',
    		'#0066FF',
    		'#0099CC',
    		'#0099FF',
    		'#00CC00',
    		'#00CC33',
    		'#00CC66',
    		'#00CC99',
    		'#00CCCC',
    		'#00CCFF',
    		'#3300CC',
    		'#3300FF',
    		'#3333CC',
    		'#3333FF',
    		'#3366CC',
    		'#3366FF',
    		'#3399CC',
    		'#3399FF',
    		'#33CC00',
    		'#33CC33',
    		'#33CC66',
    		'#33CC99',
    		'#33CCCC',
    		'#33CCFF',
    		'#6600CC',
    		'#6600FF',
    		'#6633CC',
    		'#6633FF',
    		'#66CC00',
    		'#66CC33',
    		'#9900CC',
    		'#9900FF',
    		'#9933CC',
    		'#9933FF',
    		'#99CC00',
    		'#99CC33',
    		'#CC0000',
    		'#CC0033',
    		'#CC0066',
    		'#CC0099',
    		'#CC00CC',
    		'#CC00FF',
    		'#CC3300',
    		'#CC3333',
    		'#CC3366',
    		'#CC3399',
    		'#CC33CC',
    		'#CC33FF',
    		'#CC6600',
    		'#CC6633',
    		'#CC9900',
    		'#CC9933',
    		'#CCCC00',
    		'#CCCC33',
    		'#FF0000',
    		'#FF0033',
    		'#FF0066',
    		'#FF0099',
    		'#FF00CC',
    		'#FF00FF',
    		'#FF3300',
    		'#FF3333',
    		'#FF3366',
    		'#FF3399',
    		'#FF33CC',
    		'#FF33FF',
    		'#FF6600',
    		'#FF6633',
    		'#FF9900',
    		'#FF9933',
    		'#FFCC00',
    		'#FFCC33'
    	];

    	/**
    	 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
    	 * and the Firebug extension (any Firefox version) are known
    	 * to support "%c" CSS customizations.
    	 *
    	 * TODO: add a `localStorage` variable to explicitly enable/disable colors
    	 */

    	// eslint-disable-next-line complexity
    	function useColors() {
    		// NB: In an Electron preload script, document will be defined but not fully
    		// initialized. Since we know we're in Chrome, we'll just detect this case
    		// explicitly
    		if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
    			return true;
    		}

    		// Internet Explorer and Edge do not support colors.
    		if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    			return false;
    		}

    		// Is webkit? http://stackoverflow.com/a/16459606/376773
    		// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    		return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    			// Is firebug? http://stackoverflow.com/a/398120/376773
    			(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    			// Is firefox >= v31?
    			// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    			(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    			// Double check webkit in userAgent just in case we are in a worker
    			(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
    	}

    	/**
    	 * Colorize log arguments if enabled.
    	 *
    	 * @api public
    	 */

    	function formatArgs(args) {
    		args[0] = (this.useColors ? '%c' : '') +
    			this.namespace +
    			(this.useColors ? ' %c' : ' ') +
    			args[0] +
    			(this.useColors ? '%c ' : ' ') +
    			'+' + module.exports.humanize(this.diff);

    		if (!this.useColors) {
    			return;
    		}

    		const c = 'color: ' + this.color;
    		args.splice(1, 0, c, 'color: inherit');

    		// The final "%c" is somewhat tricky, because there could be other
    		// arguments passed either before or after the %c, so we need to
    		// figure out the correct index to insert the CSS into
    		let index = 0;
    		let lastC = 0;
    		args[0].replace(/%[a-zA-Z%]/g, match => {
    			if (match === '%%') {
    				return;
    			}
    			index++;
    			if (match === '%c') {
    				// We only are interested in the *last* %c
    				// (the user may have provided their own)
    				lastC = index;
    			}
    		});

    		args.splice(lastC, 0, c);
    	}

    	/**
    	 * Invokes `console.debug()` when available.
    	 * No-op when `console.debug` is not a "function".
    	 * If `console.debug` is not available, falls back
    	 * to `console.log`.
    	 *
    	 * @api public
    	 */
    	exports.log = console.debug || console.log || (() => {});

    	/**
    	 * Save `namespaces`.
    	 *
    	 * @param {String} namespaces
    	 * @api private
    	 */
    	function save(namespaces) {
    		try {
    			if (namespaces) {
    				exports.storage.setItem('debug', namespaces);
    			} else {
    				exports.storage.removeItem('debug');
    			}
    		} catch (error) {
    			// Swallow
    			// XXX (@Qix-) should we be logging these?
    		}
    	}

    	/**
    	 * Load `namespaces`.
    	 *
    	 * @return {String} returns the previously persisted debug modes
    	 * @api private
    	 */
    	function load() {
    		let r;
    		try {
    			r = exports.storage.getItem('debug');
    		} catch (error) {
    			// Swallow
    			// XXX (@Qix-) should we be logging these?
    		}

    		// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    		if (!r && typeof process !== 'undefined' && 'env' in process) {
    			r = process.env.DEBUG;
    		}

    		return r;
    	}

    	/**
    	 * Localstorage attempts to return the localstorage.
    	 *
    	 * This is necessary because safari throws
    	 * when a user disables cookies/localstorage
    	 * and you attempt to access it.
    	 *
    	 * @return {LocalStorage}
    	 * @api private
    	 */

    	function localstorage() {
    		try {
    			// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
    			// The Browser also has localStorage in the global context.
    			return localStorage;
    		} catch (error) {
    			// Swallow
    			// XXX (@Qix-) should we be logging these?
    		}
    	}

    	module.exports = common(exports);

    	const {formatters} = module.exports;

    	/**
    	 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
    	 */

    	formatters.j = function (v) {
    		try {
    			return JSON.stringify(v);
    		} catch (error) {
    			return '[UnexpectedJSONParseError]: ' + error.message;
    		}
    	}; 
    } (browser, browser.exports));

    var browserExports = browser.exports;
    var debug3 = /*@__PURE__*/getDefaultExportFromCjs(browserExports);

    var dist = {};

    var LRUCache$1 = {};

    var LRUCacheNode$1 = {};

    Object.defineProperty(LRUCacheNode$1, "__esModule", { value: true });
    LRUCacheNode$1.LRUCacheNode = void 0;
    class LRUCacheNode {
        constructor(key, value, options) {
            const { entryExpirationTimeInMS = null, next = null, prev = null, onEntryEvicted, onEntryMarkedAsMostRecentlyUsed, clone, cloneFn } = options !== null && options !== void 0 ? options : {};
            if (typeof entryExpirationTimeInMS === 'number' &&
                (entryExpirationTimeInMS <= 0 || Number.isNaN(entryExpirationTimeInMS))) {
                throw new Error('entryExpirationTimeInMS must either be null (no expiry) or greater than 0');
            }
            this.clone = clone !== null && clone !== void 0 ? clone : false;
            this.cloneFn = cloneFn !== null && cloneFn !== void 0 ? cloneFn : this.defaultClone;
            this.key = key;
            this.internalValue = this.clone ? this.cloneFn(value) : value;
            this.created = Date.now();
            this.entryExpirationTimeInMS = entryExpirationTimeInMS;
            this.next = next;
            this.prev = prev;
            this.onEntryEvicted = onEntryEvicted;
            this.onEntryMarkedAsMostRecentlyUsed = onEntryMarkedAsMostRecentlyUsed;
        }
        get value() {
            return this.clone ? this.cloneFn(this.internalValue) : this.internalValue;
        }
        get isExpired() {
            return typeof this.entryExpirationTimeInMS === 'number' && Date.now() - this.created > this.entryExpirationTimeInMS;
        }
        invokeOnEvicted() {
            if (this.onEntryEvicted) {
                const { key, value, isExpired } = this;
                this.onEntryEvicted({ key, value, isExpired });
            }
        }
        invokeOnEntryMarkedAsMostRecentlyUsed() {
            if (this.onEntryMarkedAsMostRecentlyUsed) {
                const { key, value } = this;
                this.onEntryMarkedAsMostRecentlyUsed({ key, value });
            }
        }
        defaultClone(value) {
            if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
                return value;
            }
            return JSON.parse(JSON.stringify(value));
        }
    }
    LRUCacheNode$1.LRUCacheNode = LRUCacheNode;

    Object.defineProperty(LRUCache$1, "__esModule", { value: true });
    LRUCache$1.LRUCache = void 0;
    const LRUCacheNode_1 = LRUCacheNode$1;
    /**
     * A key value cache that implements the LRU policy.
     *
     * @typeparam TKey The type of the keys in the cache. Defaults to `string`.
     * @typeparam TValue The type of the values in the cache. Defaults to `any`.
     *
     * @see {@link https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)}
     */
    class LRUCache {
        /**
         * Creates a new instance of the LRUCache.
         *
         * @param options Additional configuration options for the LRUCache.
         *
         * @example
         * ```typescript
         * // No options.
         * const cache = new LRUCache();
         *
         * // With options.
         * const cache = new LRUCache({
         *  entryExpirationTimeInMS: 10000
         * });
         * ```
         */
        constructor(options) {
            this.lookupTable = new Map();
            this.head = null;
            this.tail = null;
            const { maxSize = 25, entryExpirationTimeInMS = null, onEntryEvicted, onEntryMarkedAsMostRecentlyUsed, cloneFn, clone } = options !== null && options !== void 0 ? options : {};
            if (Number.isNaN(maxSize) || maxSize <= 0) {
                throw new Error('maxSize must be greater than 0.');
            }
            if (typeof entryExpirationTimeInMS === 'number' &&
                (entryExpirationTimeInMS <= 0 || Number.isNaN(entryExpirationTimeInMS))) {
                throw new Error('entryExpirationTimeInMS must either be null (no expiry) or greater than 0');
            }
            this.maxSizeInternal = maxSize;
            this.entryExpirationTimeInMS = entryExpirationTimeInMS;
            this.onEntryEvicted = onEntryEvicted;
            this.onEntryMarkedAsMostRecentlyUsed = onEntryMarkedAsMostRecentlyUsed;
            this.clone = clone;
            this.cloneFn = cloneFn;
        }
        /**
         * Returns the number of entries in the LRUCache object.
         * If the cache has entryExpirationTimeInMS set, expired entries will be removed before the size is returned.
         *
         * @returns The number of entries in the cache.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * cache.set('testKey', 'testValue');
         *
         * const size = cache.size;
         *
         * // Will log 1
         * console.log(size);
         * ```
         */
        get size() {
            this.cleanCache();
            return this.lookupTable.size;
        }
        /**
         * Returns the number of entries that can still be added to the LRUCache without evicting existing entries.
         *
         * @returns The number of entries that can still be added without evicting existing entries.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache({ maxSize: 10 });
         *
         * cache.set('testKey', 'testValue');
         *
         * const remainingSize = cache.remainingSize;
         *
         * // Will log 9 due to 9 spots remaining before reaching maxSize of 10.
         * console.log(remainingSize);
         * ```
         */
        get remainingSize() {
            return this.maxSizeInternal - this.size;
        }
        /**
         * Returns the most recently used (newest) entry in the cache.
         * This will not mark the entry as recently used.
         * If the newest node is expired, it will be removed.
         *
         * @returns The most recently used (newest) entry in the cache.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache({ maxSize: 10 });
         *
         * cache.set('testKey', 'testValue');
         *
         * const newest = cache.newest;
         *
         * // Will log testValue
         * console.log(newest.value);
         *
         * // Will log testKey
         * console.log(newest.key);
         * ```
         */
        get newest() {
            if (!this.head) {
                return null;
            }
            if (this.head.isExpired) {
                this.removeNodeFromListAndLookupTable(this.head);
                return this.newest;
            }
            return this.mapNodeToEntry(this.head);
        }
        /**
         * Returns the least recently used (oldest) entry in the cache.
         * This will not mark the entry as recently used.
         * If the oldest node is expired, it will be removed.
         *
         * @returns The least recently used (oldest) entry in the cache.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache({ maxSize: 10 });
         *
         * cache.set('testKey', 'testValue');
         *
         * const oldest = cache.oldest;
         *
         * // Will log testValue
         * console.log(oldest.value);
         *
         * // Will log testKey
         * console.log(oldest.key);
         * ```
         */
        get oldest() {
            if (!this.tail) {
                return null;
            }
            if (this.tail.isExpired) {
                this.removeNodeFromListAndLookupTable(this.tail);
                return this.oldest;
            }
            return this.mapNodeToEntry(this.tail);
        }
        /**
         * Gets or sets the maxSize of the cache.
         * This will evict the least recently used entries if needed to reach new maxSize.
         *
         * @param value The new value for maxSize. Must be greater than 0.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache({ maxSize: 10 });
         *
         * cache.set('testKey', 'testValue');
         *
         * // Will be 10
         * const maxSize = cache.maxSize;
         *
         * // Set new maxSize to 5. If there are more than 5 items in the cache, the least recently used entries will be removed until cache size is 5.
         * cache.maxSize = 5;
         * ```
         */
        get maxSize() {
            return this.maxSizeInternal;
        }
        set maxSize(value) {
            if (Number.isNaN(value) || value <= 0) {
                throw new Error('maxSize must be greater than 0.');
            }
            this.maxSizeInternal = value;
            this.enforceSizeLimit();
        }
        /**
         * Sets the value for the key in the LRUCache object. Returns the LRUCache object.
         * This marks the newly added entry as the most recently used entry.
         * If adding the new entry makes the cache size go above maxSize,
         * this will evict the least recently used entries until size is equal to maxSize.
         *
         * @param key The key of the entry.
         * @param value The value to set for the key.
         * @param entryOptions Additional configuration options for the cache entry.
         *
         * @returns The LRUCache instance.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // Set the key key2 to value value2. Pass in optional options.
         * cache.set('key2', 'value2', { entryExpirationTimeInMS: 10 });
         * ```
         */
        set(key, value, entryOptions) {
            const currentNodeForKey = this.lookupTable.get(key);
            if (currentNodeForKey) {
                this.removeNodeFromListAndLookupTable(currentNodeForKey);
            }
            const node = new LRUCacheNode_1.LRUCacheNode(key, value, {
                entryExpirationTimeInMS: this.entryExpirationTimeInMS,
                onEntryEvicted: this.onEntryEvicted,
                onEntryMarkedAsMostRecentlyUsed: this.onEntryMarkedAsMostRecentlyUsed,
                clone: this.clone,
                cloneFn: this.cloneFn,
                ...entryOptions
            });
            this.setNodeAsHead(node);
            this.lookupTable.set(key, node);
            this.enforceSizeLimit();
            return this;
        }
        /**
         * Returns the value associated to the key, or null if there is none or if the entry is expired.
         * If an entry is returned, this marks the returned entry as the most recently used entry.
         *
         * @param key The key of the entry to get.
         *
         * @returns The cached value or null.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // Will be 'testValue'. Entry will now be most recently used.
         * const item1 = cache.get('testKey');
         *
         * // Will be null
         * const item2 = cache.get('keyNotInCache');
         * ```
         */
        get(key) {
            const node = this.lookupTable.get(key);
            if (!node) {
                return null;
            }
            if (node.isExpired) {
                this.removeNodeFromListAndLookupTable(node);
                return null;
            }
            this.setNodeAsHead(node);
            return node.value;
        }
        /**
         * Returns the value associated to the key, or null if there is none or if the entry is expired.
         * If an entry is returned, this will not mark the entry as most recently accessed.
         * Useful if a value is needed but the order of the cache should not be changed.
         *
         * @param key The key of the entry to get.
         *
         * @returns The cached value or null.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // Will be 'testValue'
         * const item1 = cache.peek('testKey');
         *
         * // Will be null
         * const item2 = cache.peek('keyNotInCache');
         * ```
         */
        peek(key) {
            const node = this.lookupTable.get(key);
            if (!node) {
                return null;
            }
            if (node.isExpired) {
                this.removeNodeFromListAndLookupTable(node);
                return null;
            }
            return node.value;
        }
        /**
         * Deletes the entry for the passed in key.
         *
         * @param key The key of the entry to delete
         *
         * @returns True if an element in the LRUCache object existed and has been removed,
         * or false if the element does not exist.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // Will be true
         * const wasDeleted = cache.delete('testKey');
         *
         * // Will be false
         * const wasDeleted2 = cache.delete('keyNotInCache');
         * ```
         */
        delete(key) {
            const node = this.lookupTable.get(key);
            if (!node) {
                return false;
            }
            return this.removeNodeFromListAndLookupTable(node);
        }
        /**
         * Returns a boolean asserting whether a value has been associated to the key in the LRUCache object or not.
         * This does not mark the entry as recently used.
         * If the cache has a key but the entry is expired, it will be removed and false will be returned.
         *
         * @param key The key of the entry to check if exists
         *
         * @returns true if the cache contains the supplied key. False if not.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // Will be true
         * const wasDeleted = cache.has('testKey');
         *
         * // Will be false
         * const wasDeleted2 = cache.has('keyNotInCache');
         * ```
         */
        has(key) {
            const node = this.lookupTable.get(key);
            if (!node) {
                return false;
            }
            if (node.isExpired) {
                this.removeNodeFromListAndLookupTable(node);
                return false;
            }
            return true;
        }
        /**
         * Removes all entries in the cache.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // Clear cache.
         * cache.clear();
         * ```
         */
        clear() {
            this.head = null;
            this.tail = null;
            this.lookupTable.clear();
        }
        /**
         * Searches the cache for an entry matching the passed in condition.
         * Expired entries will be skipped (and removed).
         * If multiply entries in the cache match the condition, the most recently used entry will be returned.
         * If an entry is returned, this marks the returned entry as the most recently used entry.
         *
         * @param condition The condition to apply to each entry in the
         *
         * @returns The first cache entry to match the condition. Null if none match.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * // item will be { key: 'testKey', value: 'testValue }
         * const item = cache.find(entry => {
         *   const { key, value } = entry;
         *
         *   if (key === 'testKey' || value === 'something') {
         *     return true;
         *   }
         *
         *   return false;
         * });
         *
         * // item2 will be null
         * const item2 = cache.find(entry => entry.key === 'notInCache');
         * ```
         */
        find(condition) {
            let node = this.head;
            while (node) {
                if (node.isExpired) {
                    const next = node.next;
                    this.removeNodeFromListAndLookupTable(node);
                    node = next;
                    continue;
                }
                const entry = this.mapNodeToEntry(node);
                if (condition(entry)) {
                    this.setNodeAsHead(node);
                    return entry;
                }
                node = node.next;
            }
            return null;
        }
        /**
         * Iterates over and applies the callback function to each entry in the cache.
         * Iterates in order from most recently accessed entry to least recently.
         * Expired entries will be skipped (and removed).
         * No entry will be marked as recently used.
         *
         * @param callback the callback function to apply to the entry
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * cache.forEach((key, value, index) => {
         *   // do something with key, value, and/or index
         * });
         * ```
         */
        forEach(callback) {
            let node = this.head;
            let index = 0;
            while (node) {
                if (node.isExpired) {
                    const next = node.next;
                    this.removeNodeFromListAndLookupTable(node);
                    node = next;
                    continue;
                }
                callback(node.value, node.key, index);
                node = node.next;
                index++;
            }
        }
        /**
         * Creates a Generator which can be used with for ... of ... to iterate over the cache values.
         * Iterates in order from most recently accessed entry to least recently.
         * Expired entries will be skipped (and removed).
         * No entry will be marked as accessed.
         *
         * @returns A Generator for the cache values.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * for (const value of cache.values()) {
         *   // do something with the value
         * }
         * ```
         */
        *values() {
            let node = this.head;
            while (node) {
                if (node.isExpired) {
                    const next = node.next;
                    this.removeNodeFromListAndLookupTable(node);
                    node = next;
                    continue;
                }
                yield node.value;
                node = node.next;
            }
        }
        /**
         * Creates a Generator which can be used with for ... of ... to iterate over the cache keys.
         * Iterates in order from most recently accessed entry to least recently.
         * Expired entries will be skipped (and removed).
         * No entry will be marked as accessed.
         *
         * @returns A Generator for the cache keys.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * for (const key of cache.keys()) {
         *   // do something with the key
         * }
         * ```
         */
        *keys() {
            let node = this.head;
            while (node) {
                if (node.isExpired) {
                    const next = node.next;
                    this.removeNodeFromListAndLookupTable(node);
                    node = next;
                    continue;
                }
                yield node.key;
                node = node.next;
            }
        }
        /**
         * Creates a Generator which can be used with for ... of ... to iterate over the cache entries.
         * Iterates in order from most recently accessed entry to least recently.
         * Expired entries will be skipped (and removed).
         * No entry will be marked as accessed.
         *
         * @returns A Generator for the cache entries.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * for (const entry of cache.entries()) {
         *   const { key, value } = entry;
         *   // do something with the entry
         * }
         * ```
         */
        *entries() {
            let node = this.head;
            while (node) {
                if (node.isExpired) {
                    const next = node.next;
                    this.removeNodeFromListAndLookupTable(node);
                    node = next;
                    continue;
                }
                yield this.mapNodeToEntry(node);
                node = node.next;
            }
        }
        /**
         * Creates a Generator which can be used with for ... of ... to iterate over the cache entries.
         * Iterates in order from most recently accessed entry to least recently.
         * Expired entries will be skipped (and removed).
         * No entry will be marked as accessed.
         *
         * @returns A Generator for the cache entries.
         *
         * @example
         * ```typescript
         * const cache = new LRUCache();
         *
         * // Set the key testKey to value testValue
         * cache.set('testKey', 'testValue');
         *
         * for (const entry of cache) {
         *   const { key, value } = entry;
         *   // do something with the entry
         * }
         * ```
         */
        *[Symbol.iterator]() {
            let node = this.head;
            while (node) {
                if (node.isExpired) {
                    const next = node.next;
                    this.removeNodeFromListAndLookupTable(node);
                    node = next;
                    continue;
                }
                yield this.mapNodeToEntry(node);
                node = node.next;
            }
        }
        enforceSizeLimit() {
            let node = this.tail;
            while (node !== null && this.size > this.maxSizeInternal) {
                const prev = node.prev;
                this.removeNodeFromListAndLookupTable(node);
                node = prev;
            }
        }
        mapNodeToEntry({ key, value }) {
            return {
                key,
                value
            };
        }
        setNodeAsHead(node) {
            this.removeNodeFromList(node);
            if (!this.head) {
                this.head = node;
                this.tail = node;
            }
            else {
                node.next = this.head;
                this.head.prev = node;
                this.head = node;
            }
            node.invokeOnEntryMarkedAsMostRecentlyUsed();
        }
        removeNodeFromList(node) {
            if (node.prev !== null) {
                node.prev.next = node.next;
            }
            if (node.next !== null) {
                node.next.prev = node.prev;
            }
            if (this.head === node) {
                this.head = node.next;
            }
            if (this.tail === node) {
                this.tail = node.prev;
            }
            node.next = null;
            node.prev = null;
        }
        removeNodeFromListAndLookupTable(node) {
            node.invokeOnEvicted();
            this.removeNodeFromList(node);
            return this.lookupTable.delete(node.key);
        }
        cleanCache() {
            // Don't spend time cleaning if entries don't expire.
            if (!this.entryExpirationTimeInMS) {
                return;
            }
            const expiredNodes = [];
            for (const node of this.lookupTable.values()) {
                if (node.isExpired) {
                    expiredNodes.push(node);
                }
            }
            expiredNodes.forEach(node => this.removeNodeFromListAndLookupTable(node));
        }
    }
    LRUCache$1.LRUCache = LRUCache;

    (function (exports) {
    	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    var desc = Object.getOwnPropertyDescriptor(m, k);
    	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    	      desc = { enumerable: true, get: function() { return m[k]; } };
    	    }
    	    Object.defineProperty(o, k2, desc);
    	}) : (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    o[k2] = m[k];
    	}));
    	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
    	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    	};
    	Object.defineProperty(exports, "__esModule", { value: true });
    	__exportStar(LRUCache$1, exports);
    	
    } (dist));

    var lib = {};

    (function (exports) {
    	/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    	Object.defineProperty(exports, "__esModule", { value: true });
    	exports.bytes = exports.stringToBytes = exports.str = exports.bytesToString = exports.hex = exports.utf8 = exports.bech32m = exports.bech32 = exports.base58check = exports.base58xmr = exports.base58xrp = exports.base58flickr = exports.base58 = exports.base64url = exports.base64 = exports.base32crockford = exports.base32hex = exports.base32 = exports.base16 = exports.utils = exports.assertNumber = void 0;
    	function assertNumber(n) {
    	    if (!Number.isSafeInteger(n))
    	        throw new Error(`Wrong integer: ${n}`);
    	}
    	exports.assertNumber = assertNumber;
    	function chain(...args) {
    	    const wrap = (a, b) => (c) => a(b(c));
    	    const encode = Array.from(args)
    	        .reverse()
    	        .reduce((acc, i) => (acc ? wrap(acc, i.encode) : i.encode), undefined);
    	    const decode = args.reduce((acc, i) => (acc ? wrap(acc, i.decode) : i.decode), undefined);
    	    return { encode, decode };
    	}
    	function alphabet(alphabet) {
    	    return {
    	        encode: (digits) => {
    	            if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
    	                throw new Error('alphabet.encode input should be an array of numbers');
    	            return digits.map((i) => {
    	                assertNumber(i);
    	                if (i < 0 || i >= alphabet.length)
    	                    throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet.length})`);
    	                return alphabet[i];
    	            });
    	        },
    	        decode: (input) => {
    	            if (!Array.isArray(input) || (input.length && typeof input[0] !== 'string'))
    	                throw new Error('alphabet.decode input should be array of strings');
    	            return input.map((letter) => {
    	                if (typeof letter !== 'string')
    	                    throw new Error(`alphabet.decode: not string element=${letter}`);
    	                const index = alphabet.indexOf(letter);
    	                if (index === -1)
    	                    throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet}`);
    	                return index;
    	            });
    	        },
    	    };
    	}
    	function join(separator = '') {
    	    if (typeof separator !== 'string')
    	        throw new Error('join separator should be string');
    	    return {
    	        encode: (from) => {
    	            if (!Array.isArray(from) || (from.length && typeof from[0] !== 'string'))
    	                throw new Error('join.encode input should be array of strings');
    	            for (let i of from)
    	                if (typeof i !== 'string')
    	                    throw new Error(`join.encode: non-string input=${i}`);
    	            return from.join(separator);
    	        },
    	        decode: (to) => {
    	            if (typeof to !== 'string')
    	                throw new Error('join.decode input should be string');
    	            return to.split(separator);
    	        },
    	    };
    	}
    	function padding(bits, chr = '=') {
    	    assertNumber(bits);
    	    if (typeof chr !== 'string')
    	        throw new Error('padding chr should be string');
    	    return {
    	        encode(data) {
    	            if (!Array.isArray(data) || (data.length && typeof data[0] !== 'string'))
    	                throw new Error('padding.encode input should be array of strings');
    	            for (let i of data)
    	                if (typeof i !== 'string')
    	                    throw new Error(`padding.encode: non-string input=${i}`);
    	            while ((data.length * bits) % 8)
    	                data.push(chr);
    	            return data;
    	        },
    	        decode(input) {
    	            if (!Array.isArray(input) || (input.length && typeof input[0] !== 'string'))
    	                throw new Error('padding.encode input should be array of strings');
    	            for (let i of input)
    	                if (typeof i !== 'string')
    	                    throw new Error(`padding.decode: non-string input=${i}`);
    	            let end = input.length;
    	            if ((end * bits) % 8)
    	                throw new Error('Invalid padding: string should have whole number of bytes');
    	            for (; end > 0 && input[end - 1] === chr; end--) {
    	                if (!(((end - 1) * bits) % 8))
    	                    throw new Error('Invalid padding: string has too much padding');
    	            }
    	            return input.slice(0, end);
    	        },
    	    };
    	}
    	function normalize(fn) {
    	    if (typeof fn !== 'function')
    	        throw new Error('normalize fn should be function');
    	    return { encode: (from) => from, decode: (to) => fn(to) };
    	}
    	function convertRadix(data, from, to) {
    	    if (from < 2)
    	        throw new Error(`convertRadix: wrong from=${from}, base cannot be less than 2`);
    	    if (to < 2)
    	        throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
    	    if (!Array.isArray(data))
    	        throw new Error('convertRadix: data should be array');
    	    if (!data.length)
    	        return [];
    	    let pos = 0;
    	    const res = [];
    	    const digits = Array.from(data);
    	    digits.forEach((d) => {
    	        assertNumber(d);
    	        if (d < 0 || d >= from)
    	            throw new Error(`Wrong integer: ${d}`);
    	    });
    	    while (true) {
    	        let carry = 0;
    	        let done = true;
    	        for (let i = pos; i < digits.length; i++) {
    	            const digit = digits[i];
    	            const digitBase = from * carry + digit;
    	            if (!Number.isSafeInteger(digitBase) ||
    	                (from * carry) / from !== carry ||
    	                digitBase - digit !== from * carry) {
    	                throw new Error('convertRadix: carry overflow');
    	            }
    	            carry = digitBase % to;
    	            digits[i] = Math.floor(digitBase / to);
    	            if (!Number.isSafeInteger(digits[i]) || digits[i] * to + carry !== digitBase)
    	                throw new Error('convertRadix: carry overflow');
    	            if (!done)
    	                continue;
    	            else if (!digits[i])
    	                pos = i;
    	            else
    	                done = false;
    	        }
    	        res.push(carry);
    	        if (done)
    	            break;
    	    }
    	    for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
    	        res.push(0);
    	    return res.reverse();
    	}
    	const gcd = (a, b) => (!b ? a : gcd(b, a % b));
    	const radix2carry = (from, to) => from + (to - gcd(from, to));
    	function convertRadix2(data, from, to, padding) {
    	    if (!Array.isArray(data))
    	        throw new Error('convertRadix2: data should be array');
    	    if (from <= 0 || from > 32)
    	        throw new Error(`convertRadix2: wrong from=${from}`);
    	    if (to <= 0 || to > 32)
    	        throw new Error(`convertRadix2: wrong to=${to}`);
    	    if (radix2carry(from, to) > 32) {
    	        throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
    	    }
    	    let carry = 0;
    	    let pos = 0;
    	    const mask = 2 ** to - 1;
    	    const res = [];
    	    for (const n of data) {
    	        assertNumber(n);
    	        if (n >= 2 ** from)
    	            throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    	        carry = (carry << from) | n;
    	        if (pos + from > 32)
    	            throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    	        pos += from;
    	        for (; pos >= to; pos -= to)
    	            res.push(((carry >> (pos - to)) & mask) >>> 0);
    	        carry &= 2 ** pos - 1;
    	    }
    	    carry = (carry << (to - pos)) & mask;
    	    if (!padding && pos >= from)
    	        throw new Error('Excess padding');
    	    if (!padding && carry)
    	        throw new Error(`Non-zero padding: ${carry}`);
    	    if (padding && pos > 0)
    	        res.push(carry >>> 0);
    	    return res;
    	}
    	function radix(num) {
    	    assertNumber(num);
    	    return {
    	        encode: (bytes) => {
    	            if (!(bytes instanceof Uint8Array))
    	                throw new Error('radix.encode input should be Uint8Array');
    	            return convertRadix(Array.from(bytes), 2 ** 8, num);
    	        },
    	        decode: (digits) => {
    	            if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
    	                throw new Error('radix.decode input should be array of strings');
    	            return Uint8Array.from(convertRadix(digits, num, 2 ** 8));
    	        },
    	    };
    	}
    	function radix2(bits, revPadding = false) {
    	    assertNumber(bits);
    	    if (bits <= 0 || bits > 32)
    	        throw new Error('radix2: bits should be in (0..32]');
    	    if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
    	        throw new Error('radix2: carry overflow');
    	    return {
    	        encode: (bytes) => {
    	            if (!(bytes instanceof Uint8Array))
    	                throw new Error('radix2.encode input should be Uint8Array');
    	            return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    	        },
    	        decode: (digits) => {
    	            if (!Array.isArray(digits) || (digits.length && typeof digits[0] !== 'number'))
    	                throw new Error('radix2.decode input should be array of strings');
    	            return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    	        },
    	    };
    	}
    	function unsafeWrapper(fn) {
    	    if (typeof fn !== 'function')
    	        throw new Error('unsafeWrapper fn should be function');
    	    return function (...args) {
    	        try {
    	            return fn.apply(null, args);
    	        }
    	        catch (e) { }
    	    };
    	}
    	function checksum(len, fn) {
    	    assertNumber(len);
    	    if (typeof fn !== 'function')
    	        throw new Error('checksum fn should be function');
    	    return {
    	        encode(data) {
    	            if (!(data instanceof Uint8Array))
    	                throw new Error('checksum.encode: input should be Uint8Array');
    	            const checksum = fn(data).slice(0, len);
    	            const res = new Uint8Array(data.length + len);
    	            res.set(data);
    	            res.set(checksum, data.length);
    	            return res;
    	        },
    	        decode(data) {
    	            if (!(data instanceof Uint8Array))
    	                throw new Error('checksum.decode: input should be Uint8Array');
    	            const payload = data.slice(0, -len);
    	            const newChecksum = fn(payload).slice(0, len);
    	            const oldChecksum = data.slice(-len);
    	            for (let i = 0; i < len; i++)
    	                if (newChecksum[i] !== oldChecksum[i])
    	                    throw new Error('Invalid checksum');
    	            return payload;
    	        },
    	    };
    	}
    	exports.utils = { alphabet, chain, checksum, radix, radix2, join, padding };
    	exports.base16 = chain(radix2(4), alphabet('0123456789ABCDEF'), join(''));
    	exports.base32 = chain(radix2(5), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'), padding(5), join(''));
    	exports.base32hex = chain(radix2(5), alphabet('0123456789ABCDEFGHIJKLMNOPQRSTUV'), padding(5), join(''));
    	exports.base32crockford = chain(radix2(5), alphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ'), join(''), normalize((s) => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')));
    	exports.base64 = chain(radix2(6), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'), padding(6), join(''));
    	exports.base64url = chain(radix2(6), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'), padding(6), join(''));
    	const genBase58 = (abc) => chain(radix(58), alphabet(abc), join(''));
    	exports.base58 = genBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
    	exports.base58flickr = genBase58('123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ');
    	exports.base58xrp = genBase58('rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz');
    	const XMR_BLOCK_LEN = [0, 2, 3, 5, 6, 7, 9, 10, 11];
    	exports.base58xmr = {
    	    encode(data) {
    	        let res = '';
    	        for (let i = 0; i < data.length; i += 8) {
    	            const block = data.subarray(i, i + 8);
    	            res += exports.base58.encode(block).padStart(XMR_BLOCK_LEN[block.length], '1');
    	        }
    	        return res;
    	    },
    	    decode(str) {
    	        let res = [];
    	        for (let i = 0; i < str.length; i += 11) {
    	            const slice = str.slice(i, i + 11);
    	            const blockLen = XMR_BLOCK_LEN.indexOf(slice.length);
    	            const block = exports.base58.decode(slice);
    	            for (let j = 0; j < block.length - blockLen; j++) {
    	                if (block[j] !== 0)
    	                    throw new Error('base58xmr: wrong padding');
    	            }
    	            res = res.concat(Array.from(block.slice(block.length - blockLen)));
    	        }
    	        return Uint8Array.from(res);
    	    },
    	};
    	const base58check = (sha256) => chain(checksum(4, (data) => sha256(sha256(data))), exports.base58);
    	exports.base58check = base58check;
    	const BECH_ALPHABET = chain(alphabet('qpzry9x8gf2tvdw0s3jn54khce6mua7l'), join(''));
    	const POLYMOD_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    	function bech32Polymod(pre) {
    	    const b = pre >> 25;
    	    let chk = (pre & 0x1ffffff) << 5;
    	    for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
    	        if (((b >> i) & 1) === 1)
    	            chk ^= POLYMOD_GENERATORS[i];
    	    }
    	    return chk;
    	}
    	function bechChecksum(prefix, words, encodingConst = 1) {
    	    const len = prefix.length;
    	    let chk = 1;
    	    for (let i = 0; i < len; i++) {
    	        const c = prefix.charCodeAt(i);
    	        if (c < 33 || c > 126)
    	            throw new Error(`Invalid prefix (${prefix})`);
    	        chk = bech32Polymod(chk) ^ (c >> 5);
    	    }
    	    chk = bech32Polymod(chk);
    	    for (let i = 0; i < len; i++)
    	        chk = bech32Polymod(chk) ^ (prefix.charCodeAt(i) & 0x1f);
    	    for (let v of words)
    	        chk = bech32Polymod(chk) ^ v;
    	    for (let i = 0; i < 6; i++)
    	        chk = bech32Polymod(chk);
    	    chk ^= encodingConst;
    	    return BECH_ALPHABET.encode(convertRadix2([chk % 2 ** 30], 30, 5, false));
    	}
    	function genBech32(encoding) {
    	    const ENCODING_CONST = encoding === 'bech32' ? 1 : 0x2bc830a3;
    	    const _words = radix2(5);
    	    const fromWords = _words.decode;
    	    const toWords = _words.encode;
    	    const fromWordsUnsafe = unsafeWrapper(fromWords);
    	    function encode(prefix, words, limit = 90) {
    	        if (typeof prefix !== 'string')
    	            throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
    	        if (!Array.isArray(words) || (words.length && typeof words[0] !== 'number'))
    	            throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
    	        const actualLength = prefix.length + 7 + words.length;
    	        if (limit !== false && actualLength > limit)
    	            throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    	        prefix = prefix.toLowerCase();
    	        return `${prefix}1${BECH_ALPHABET.encode(words)}${bechChecksum(prefix, words, ENCODING_CONST)}`;
    	    }
    	    function decode(str, limit = 90) {
    	        if (typeof str !== 'string')
    	            throw new Error(`bech32.decode input should be string, not ${typeof str}`);
    	        if (str.length < 8 || (limit !== false && str.length > limit))
    	            throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
    	        const lowered = str.toLowerCase();
    	        if (str !== lowered && str !== str.toUpperCase())
    	            throw new Error(`String must be lowercase or uppercase`);
    	        str = lowered;
    	        const sepIndex = str.lastIndexOf('1');
    	        if (sepIndex === 0 || sepIndex === -1)
    	            throw new Error(`Letter "1" must be present between prefix and data only`);
    	        const prefix = str.slice(0, sepIndex);
    	        const _words = str.slice(sepIndex + 1);
    	        if (_words.length < 6)
    	            throw new Error('Data must be at least 6 characters long');
    	        const words = BECH_ALPHABET.decode(_words).slice(0, -6);
    	        const sum = bechChecksum(prefix, words, ENCODING_CONST);
    	        if (!_words.endsWith(sum))
    	            throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    	        return { prefix, words };
    	    }
    	    const decodeUnsafe = unsafeWrapper(decode);
    	    function decodeToBytes(str) {
    	        const { prefix, words } = decode(str, false);
    	        return { prefix, words, bytes: fromWords(words) };
    	    }
    	    return { encode, decode, decodeToBytes, decodeUnsafe, fromWords, fromWordsUnsafe, toWords };
    	}
    	exports.bech32 = genBech32('bech32');
    	exports.bech32m = genBech32('bech32m');
    	exports.utf8 = {
    	    encode: (data) => new TextDecoder().decode(data),
    	    decode: (str) => new TextEncoder().encode(str),
    	};
    	exports.hex = chain(radix2(4), alphabet('0123456789abcdef'), join(''), normalize((s) => {
    	    if (typeof s !== 'string' || s.length % 2)
    	        throw new TypeError(`hex.decode: expected string, got ${typeof s} with length ${s.length}`);
    	    return s.toLowerCase();
    	}));
    	const CODERS = {
    	    utf8: exports.utf8, hex: exports.hex, base16: exports.base16, base32: exports.base32, base64: exports.base64, base64url: exports.base64url, base58: exports.base58, base58xmr: exports.base58xmr
    	};
    	const coderTypeError = `Invalid encoding type. Available types: ${Object.keys(CODERS).join(', ')}`;
    	const bytesToString = (type, bytes) => {
    	    if (typeof type !== 'string' || !CODERS.hasOwnProperty(type))
    	        throw new TypeError(coderTypeError);
    	    if (!(bytes instanceof Uint8Array))
    	        throw new TypeError('bytesToString() expects Uint8Array');
    	    return CODERS[type].encode(bytes);
    	};
    	exports.bytesToString = bytesToString;
    	exports.str = exports.bytesToString;
    	const stringToBytes = (type, str) => {
    	    if (!CODERS.hasOwnProperty(type))
    	        throw new TypeError(coderTypeError);
    	    if (typeof str !== 'string')
    	        throw new TypeError('stringToBytes() expects string');
    	    return CODERS[type].decode(str);
    	};
    	exports.stringToBytes = stringToBytes;
    	exports.bytes = exports.stringToBytes; 
    } (lib));

    ({
      m: BigInt(1e3),
      u: BigInt(1e6),
      n: BigInt(1e9),
      p: BigInt(1e12)
    });

    BigInt('2100000000000000000');

    BigInt(1e11);

    const TAGCODES = {
      payment_hash: 1,
      payment_secret: 16,
      description: 13,
      payee: 19,
      description_hash: 23, // commit to longer descriptions (used by lnurl-pay)
      expiry: 6, // default: 3600 (1 hour)
      min_final_cltv_expiry: 24, // default: 9
      fallback_address: 9,
      route_hint: 3, // for extra routing info (private etc.)
      feature_bits: 5,
      metadata: 27
    };
    for (let i = 0, keys = Object.keys(TAGCODES); i < keys.length; i++) {
      keys[i];
      TAGCODES[keys[i]].toString();
    }

    // src/user/index.ts
    var NDKRelayConnectivity = class {
      ndkRelay;
      _status;
      relay;
      connectedAt;
      _connectionStats = {
        attempts: 0,
        success: 0,
        durations: []
      };
      debug;
      constructor(ndkRelay) {
        this.ndkRelay = ndkRelay;
        this._status = 3 /* DISCONNECTED */;
        this.relay = relayInit(this.ndkRelay.url);
        this.debug = this.ndkRelay.debug.extend("connectivity");
        this.relay.on("notice", (notice) => this.handleNotice(notice));
      }
      async initiateAuth(filter = { limit: 1 }) {
        this.debug("Initiating authentication");
        const authSub = this.relay.sub([filter], { id: "auth-test" });
        authSub.on("eose", () => {
          authSub.unsub();
          this._status = 1 /* CONNECTED */;
          this.ndkRelay.emit("ready");
          this.debug("Authentication not required");
          authSub.unsub();
        });
        this.debug("Authentication request started");
      }
      async connect() {
        const connectHandler = () => {
          this.updateConnectionStats.connected();
          if (!this.ndkRelay.authRequired) {
            this._status = 1 /* CONNECTED */;
            this.ndkRelay.emit("connect");
            this.ndkRelay.emit("ready");
          } else {
            this._status = 6 /* AUTH_REQUIRED */;
            this.ndkRelay.emit("connect");
            this.initiateAuth();
          }
        };
        const disconnectHandler = () => {
          this.updateConnectionStats.disconnected();
          if (this._status === 1 /* CONNECTED */) {
            this._status = 3 /* DISCONNECTED */;
            this.handleReconnection();
          }
          this.ndkRelay.emit("disconnect");
        };
        const authHandler = async (challenge) => {
          this.debug("Relay requested authentication", {
            havePolicy: !!this.ndkRelay.authPolicy
          });
          if (this.ndkRelay.authPolicy) {
            if (this._status !== 7 /* AUTHENTICATING */) {
              this._status = 7 /* AUTHENTICATING */;
              await this.ndkRelay.authPolicy(this.ndkRelay, challenge);
              if (this._status === 7 /* AUTHENTICATING */) {
                this.debug("Authentication policy finished");
                this._status = 1 /* CONNECTED */;
                this.ndkRelay.emit("ready");
              }
            }
          } else {
            await this.ndkRelay.emit("auth", challenge);
          }
        };
        try {
          this.updateConnectionStats.attempt();
          this._status = 0 /* CONNECTING */;
          this.relay.off("connect", connectHandler);
          this.relay.off("disconnect", disconnectHandler);
          this.relay.on("connect", connectHandler);
          this.relay.on("disconnect", disconnectHandler);
          this.relay.on("auth", authHandler);
          await this.relay.connect();
        } catch (e) {
          this.debug("Failed to connect", e);
          this._status = 3 /* DISCONNECTED */;
          throw e;
        }
      }
      disconnect() {
        this._status = 2 /* DISCONNECTING */;
        this.relay.close();
      }
      get status() {
        return this._status;
      }
      isAvailable() {
        return this._status === 1 /* CONNECTED */;
      }
      /**
       * Evaluates the connection stats to determine if the relay is flapping.
       */
      isFlapping() {
        const durations = this._connectionStats.durations;
        if (durations.length % 3 !== 0)
          return false;
        const sum = durations.reduce((a, b) => a + b, 0);
        const avg = sum / durations.length;
        const variance = durations.map((x) => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / durations.length;
        const stdDev = Math.sqrt(variance);
        const isFlapping = stdDev < 1e3;
        return isFlapping;
      }
      async handleNotice(notice) {
        if (notice.includes("oo many") || notice.includes("aximum")) {
          this.disconnect();
          setTimeout(() => this.connect(), 2e3);
          this.debug(this.relay.url, "Relay complaining?", notice);
        }
        this.ndkRelay.emit("notice", this, notice);
      }
      /**
       * Called when the relay is unexpectedly disconnected.
       */
      handleReconnection(attempt = 0) {
        if (this.isFlapping()) {
          this.ndkRelay.emit("flapping", this, this._connectionStats);
          this._status = 5 /* FLAPPING */;
          return;
        }
        const reconnectDelay = this.connectedAt ? Math.max(0, 6e4 - (Date.now() - this.connectedAt)) : 0;
        setTimeout(() => {
          this._status = 4 /* RECONNECTING */;
          this.connect().then(() => {
            this.debug("Reconnected");
          }).catch((err) => {
            this.debug("Reconnect failed", err);
            if (attempt < 5) {
              setTimeout(() => {
                this.handleReconnection(attempt + 1);
              }, 6e4);
            } else {
              this.debug("Reconnect failed after 5 attempts");
            }
          });
        }, reconnectDelay);
      }
      /**
       * Utility functions to update the connection stats.
       */
      updateConnectionStats = {
        connected: () => {
          this._connectionStats.success++;
          this._connectionStats.connectedAt = Date.now();
        },
        disconnected: () => {
          if (this._connectionStats.connectedAt) {
            this._connectionStats.durations.push(
              Date.now() - this._connectionStats.connectedAt
            );
            if (this._connectionStats.durations.length > 100) {
              this._connectionStats.durations.shift();
            }
          }
          this._connectionStats.connectedAt = void 0;
        },
        attempt: () => {
          this._connectionStats.attempts++;
        }
      };
      /**
       * Returns the connection stats.
       */
      get connectionStats() {
        return this._connectionStats;
      }
    };

    // src/relay/publisher.ts
    var NDKRelayPublisher = class {
      ndkRelay;
      constructor(ndkRelay) {
        this.ndkRelay = ndkRelay;
      }
      /**
       * Published an event to the relay; if the relay is not connected, it will
       * wait for the relay to connect before publishing the event.
       *
       * If the relay does not connect within the timeout, the publish operation
       * will fail.
       * @param event  The event to publish
       * @param timeoutMs  The timeout for the publish operation in milliseconds
       * @returns A promise that resolves when the event has been published or rejects if the operation times out
       */
      async publish(event, timeoutMs = 2500) {
        const publishWhenConnected = () => {
          return new Promise((resolve, reject) => {
            try {
              this.publishEvent(event, timeoutMs).then((result) => resolve(result)).catch((err) => reject(err));
            } catch (err) {
              reject(err);
            }
          });
        };
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), timeoutMs);
        });
        const onConnectHandler = () => {
          publishWhenConnected().then((result) => connectResolve(result)).catch((err) => connectReject(err));
        };
        let connectResolve;
        let connectReject;
        if (this.ndkRelay.status === 1 /* CONNECTED */) {
          return Promise.race([publishWhenConnected(), timeoutPromise]);
        } else {
          return Promise.race([
            new Promise((resolve, reject) => {
              connectResolve = resolve;
              connectReject = reject;
              this.ndkRelay.once("connect", onConnectHandler);
            }),
            timeoutPromise
          ]).finally(() => {
            this.ndkRelay.removeListener("connect", onConnectHandler);
          });
        }
      }
      async publishEvent(event, timeoutMs) {
        const nostrEvent = await event.toNostrEvent();
        const publish = this.ndkRelay.connectivity.relay.publish(nostrEvent);
        let publishTimeout;
        const publishPromise = new Promise((resolve, reject) => {
          publish.then(() => {
            clearTimeout(publishTimeout);
            this.ndkRelay.emit("published", event);
            resolve(true);
          }).catch((err) => {
            clearTimeout(publishTimeout);
            this.ndkRelay.debug("Publish failed", err, event.id);
            this.ndkRelay.emit("publish:failed", event, err);
            reject(err);
          });
        });
        if (!timeoutMs || event.isEphemeral()) {
          return publishPromise;
        }
        const timeoutPromise = new Promise((_, reject) => {
          publishTimeout = setTimeout(() => {
            this.ndkRelay.debug("Publish timed out", event.rawEvent());
            this.ndkRelay.emit("publish:failed", event, "Timeout");
            reject(new Error("Publish operation timed out"));
          }, timeoutMs);
        });
        return Promise.race([publishPromise, timeoutPromise]);
      }
      async auth(event) {
        return this.ndkRelay.connectivity.relay.auth(event.rawEvent());
      }
    };

    // src/subscription/grouping.ts
    function calculateGroupableId(filters) {
      const elements = [];
      for (const filter of filters) {
        const hasTimeConstraints = filter.since || filter.until;
        if (hasTimeConstraints)
          return null;
        const keys = Object.keys(filter || {}).sort().join("-");
        elements.push(keys);
      }
      return elements.join("|");
    }
    function mergeFilters(filters) {
      const result = {};
      filters.forEach((filter) => {
        Object.entries(filter).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            if (result[key] === void 0) {
              result[key] = [...value];
            } else {
              result[key] = Array.from(/* @__PURE__ */ new Set([...result[key], ...value]));
            }
          } else {
            result[key] = value;
          }
        });
      });
      return result;
    }
    var MAX_SUBID_LENGTH = 20;
    function queryFullyFilled(subscription) {
      if (filterIncludesIds(subscription.filter)) {
        if (resultHasAllRequestedIds(subscription)) {
          return true;
        }
      }
      return false;
    }
    function compareFilter(filter1, filter2) {
      if (Object.keys(filter1).length !== Object.keys(filter2).length)
        return false;
      for (const [key, value] of Object.entries(filter1)) {
        const valuesInFilter2 = filter2[key];
        if (!valuesInFilter2)
          return false;
        if (Array.isArray(value) && Array.isArray(valuesInFilter2)) {
          const v = value;
          for (const valueInFilter2 of valuesInFilter2) {
            const val = valueInFilter2;
            if (!v.includes(val)) {
              return false;
            }
          }
        } else {
          if (valuesInFilter2 !== value)
            return false;
        }
      }
      return true;
    }
    function filterIncludesIds(filter) {
      return !!filter["ids"];
    }
    function resultHasAllRequestedIds(subscription) {
      const ids = subscription.filter["ids"];
      return !!ids && ids.length === subscription.eventFirstSeen.size;
    }
    function generateSubId(subscriptions, filters) {
      const subIds = subscriptions.map((sub) => sub.subId).filter(Boolean);
      const subIdParts = [];
      const filterNonKindKeys = /* @__PURE__ */ new Set();
      const filterKinds = /* @__PURE__ */ new Set();
      if (subIds.length > 0) {
        subIdParts.push(Array.from(new Set(subIds)).join(","));
      } else {
        for (const filter of filters) {
          for (const key of Object.keys(filter)) {
            if (key === "kinds") {
              filter.kinds?.forEach((k) => filterKinds.add(k));
            } else {
              filterNonKindKeys.add(key);
            }
          }
        }
        if (filterKinds.size > 0) {
          subIdParts.push("kinds:" + Array.from(filterKinds).join(","));
        }
        if (filterNonKindKeys.size > 0) {
          subIdParts.push(Array.from(filterNonKindKeys).join(","));
        }
      }
      let subId = subIdParts.join("-");
      if (subId.length > MAX_SUBID_LENGTH)
        subId = subId.substring(0, MAX_SUBID_LENGTH);
      if (subIds.length !== 1) {
        subId += "-" + Math.floor(Math.random() * 999).toString();
      }
      return subId;
    }
    function filterFromId(id) {
      let decoded;
      if (id.match(NIP33_A_REGEX)) {
        const [kind, pubkey, identifier] = id.split(":");
        const filter = {
          authors: [pubkey],
          kinds: [parseInt(kind)]
        };
        if (identifier) {
          filter["#d"] = [identifier];
        }
        return filter;
      }
      try {
        decoded = nip19_exports.decode(id);
        switch (decoded.type) {
          case "nevent":
            return { ids: [decoded.data.id] };
          case "note":
            return { ids: [decoded.data] };
          case "naddr":
            return {
              authors: [decoded.data.pubkey],
              "#d": [decoded.data.identifier],
              kinds: [decoded.data.kind]
            };
        }
      } catch (e) {
      }
      return { ids: [id] };
    }
    function isNip33AValue(value) {
      return value.match(NIP33_A_REGEX) !== null;
    }
    var NIP33_A_REGEX = /^(\d+):([0-9A-Fa-f]+)(?::(.*))?$/;
    function relaysFromBech32(bech322) {
      try {
        const decoded = nip19_exports.decode(bech322);
        if (["naddr", "nevent"].includes(decoded?.type)) {
          const data = decoded.data;
          if (data?.relays) {
            return data.relays.map((r) => new NDKRelay(r));
          }
        }
      } catch (e) {
      }
      return [];
    }

    // src/relay/subscriptions.ts
    var NDKGroupedSubscriptions = class extends lib$1.EventEmitter {
      subscriptions;
      req;
      debug;
      constructor(subscriptions, debug4) {
        super();
        this.subscriptions = subscriptions;
        this.debug = debug4 || this.subscriptions[0].subscription.debug.extend("grouped");
        for (const subscription of subscriptions) {
          this.handleSubscriptionClosure(subscription);
        }
      }
      /**
       * Adds a subscription to this group.
       * @param subscription
       */
      addSubscription(subscription) {
        this.subscriptions.push(subscription);
        this.handleSubscriptionClosure(subscription);
      }
      eventReceived(event) {
        for (const subscription of this.subscriptions) {
          subscription.eventReceived(event);
        }
      }
      eoseReceived(relay) {
        const subscriptionsToInform = Array.from(this.subscriptions);
        subscriptionsToInform.forEach(async (subscription) => {
          subscription.subscription.eoseReceived(relay);
        });
      }
      handleSubscriptionClosure(subscription) {
        subscription.subscription.on("close", () => {
          const index = this.subscriptions.findIndex(
            (i) => i.subscription === subscription.subscription
          );
          this.subscriptions.splice(index, 1);
          if (this.subscriptions.length <= 0) {
            this.emit("close");
          }
        });
      }
      /**
       * Maps each subscription through a transformation function.
       * @param fn - The transformation function.
       * @returns A new array with each subscription transformed by fn.
       */
      map(fn) {
        return this.subscriptions.map(fn);
      }
      [Symbol.iterator]() {
        let index = 0;
        const subscriptions = this.subscriptions;
        return {
          next() {
            if (index < subscriptions.length) {
              return { value: subscriptions[index++], done: false };
            } else {
              return { value: null, done: true };
            }
          }
        };
      }
    };
    var NDKSubscriptionFilters = class {
      subscription;
      filters = [];
      ndkRelay;
      constructor(subscription, filters, ndkRelay) {
        this.subscription = subscription;
        this.filters = filters;
        this.ndkRelay = ndkRelay;
      }
      eventReceived(event) {
        if (!this.eventMatchesLocalFilter(event))
          return;
        this.subscription.eventReceived(event, this.ndkRelay, false);
      }
      eventMatchesLocalFilter(event) {
        const rawEvent = event.rawEvent();
        return this.filters.some((filter) => matchFilter(filter, rawEvent));
      }
    };
    function findMatchingActiveSubscriptions(activeSubscriptions, filters) {
      if (activeSubscriptions.length !== filters.length)
        return false;
      for (let i = 0; i < activeSubscriptions.length; i++) {
        if (!compareFilter(activeSubscriptions[i], filters[i])) {
          break;
        }
        return activeSubscriptions[i];
      }
      return void 0;
    }
    var NDKRelaySubscriptions = class {
      ndkRelay;
      delayedItems = /* @__PURE__ */ new Map();
      delayedTimers = /* @__PURE__ */ new Map();
      /**
       * Active subscriptions this relay is connected to
       */
      activeSubscriptions = /* @__PURE__ */ new Map();
      activeSubscriptionsByGroupId = /* @__PURE__ */ new Map();
      executionTimeoutsByGroupId = /* @__PURE__ */ new Map();
      debug;
      groupingDebug;
      conn;
      constructor(ndkRelay) {
        this.ndkRelay = ndkRelay;
        this.conn = ndkRelay.connectivity;
        this.debug = ndkRelay.debug.extend("subscriptions");
        this.groupingDebug = ndkRelay.debug.extend("grouping");
      }
      /**
       * Creates or queues a subscription to the relay.
       */
      subscribe(subscription, filters) {
        const groupableId = calculateGroupableId(filters);
        const subscriptionFilters = new NDKSubscriptionFilters(
          subscription,
          filters,
          this.ndkRelay
        );
        const isNotGroupable = !groupableId || !subscription.isGroupable();
        if (isNotGroupable) {
          this.executeSubscriptions(
            groupableId,
            // hacky
            new NDKGroupedSubscriptions([subscriptionFilters]),
            filters
          );
          return;
        }
        const activeSubscriptions = this.activeSubscriptionsByGroupId.get(groupableId);
        if (activeSubscriptions) {
          const matchingSubscription = findMatchingActiveSubscriptions(
            activeSubscriptions.filters,
            filters
          );
          if (matchingSubscription) {
            const activeSubscription = this.activeSubscriptions.get(activeSubscriptions.sub);
            activeSubscription?.addSubscription(
              new NDKSubscriptionFilters(subscription, filters, this.ndkRelay)
            );
            return;
          }
        }
        let delayedItem = this.delayedItems.get(groupableId);
        if (!delayedItem) {
          delayedItem = new NDKGroupedSubscriptions([subscriptionFilters]);
          this.delayedItems.set(groupableId, delayedItem);
          delayedItem.once("close", () => {
            const delayedItem2 = this.delayedItems.get(groupableId);
            if (!delayedItem2)
              return;
            this.delayedItems.delete(groupableId);
          });
        } else {
          delayedItem.addSubscription(subscriptionFilters);
        }
        let timeout = this.executionTimeoutsByGroupId.get(groupableId);
        if (!timeout || subscription.opts.groupableDelayType === "at-most") {
          timeout = setTimeout(() => {
            this.executeGroup(groupableId, subscription);
          }, subscription.opts.groupableDelay);
          this.executionTimeoutsByGroupId.set(groupableId, timeout);
        }
        if (this.delayedTimers.has(groupableId)) {
          this.delayedTimers.get(groupableId).push(timeout);
        } else {
          this.delayedTimers.set(groupableId, [timeout]);
        }
      }
      /**
       * Executes a delayed subscription via its groupable ID.
       * @param groupableId
       */
      executeGroup(groupableId, triggeredBy) {
        const delayedItem = this.delayedItems.get(groupableId);
        this.delayedItems.delete(groupableId);
        const timeouts = this.delayedTimers.get(groupableId);
        this.delayedTimers.delete(groupableId);
        if (timeouts) {
          for (const timeout of timeouts) {
            clearTimeout(timeout);
          }
        }
        if (delayedItem) {
          const filterCount = delayedItem.subscriptions[0].filters.length;
          const mergedFilters = [];
          for (let i = 0; i < filterCount; i++) {
            const allFiltersAtIndex = delayedItem.map((di) => di.filters[i]);
            mergedFilters.push(mergeFilters(allFiltersAtIndex));
          }
          this.executeSubscriptions(groupableId, delayedItem, mergedFilters);
        }
      }
      executeSubscriptionsWhenConnected(groupableId, groupedSubscriptions, mergedFilters) {
        const readyListener = () => {
          this.debug("new relay coming online for active subscription", {
            relay: this.ndkRelay.url,
            mergeFilters
          });
          this.executeSubscriptionsConnected(groupableId, groupedSubscriptions, mergedFilters);
        };
        this.ndkRelay.once("ready", readyListener);
        groupedSubscriptions.once("close", () => {
          this.ndkRelay.removeListener("ready", readyListener);
        });
      }
      /**
       * Executes one or more subscriptions.
       *
       * If the relay is not connected, subscriptions will be queued
       * until the relay connects.
       *
       * @param groupableId
       * @param subscriptionFilters
       * @param mergedFilters
       */
      executeSubscriptions(groupableId, groupedSubscriptions, mergedFilters) {
        if (this.conn.isAvailable()) {
          this.executeSubscriptionsConnected(groupableId, groupedSubscriptions, mergedFilters);
        } else {
          this.executeSubscriptionsWhenConnected(
            groupableId,
            groupedSubscriptions,
            mergedFilters
          );
        }
      }
      /**
       * Executes one or more subscriptions.
       *
       * When there are more than one subscription, results
       * will be sent to the right subscription
       *
       * @param subscriptions
       * @param filters The filters as they should be sent to the relay
       */
      executeSubscriptionsConnected(groupableId, groupedSubscriptions, mergedFilters) {
        const subscriptions = [];
        for (const { subscription } of groupedSubscriptions) {
          subscriptions.push(subscription);
        }
        const subId = generateSubId(subscriptions, mergedFilters);
        groupedSubscriptions.req = mergedFilters;
        const subOptions = { id: subId };
        if (this.ndkRelay.trusted || subscriptions.every((sub2) => sub2.opts.skipVerification)) {
          subOptions.skipVerification = true;
        }
        const sub = this.conn.relay.sub(mergedFilters, subOptions);
        this.activeSubscriptions.set(sub, groupedSubscriptions);
        if (groupableId) {
          this.activeSubscriptionsByGroupId.set(groupableId, { filters: mergedFilters, sub });
        }
        sub.on("event", (event) => {
          const e = new NDKEvent(void 0, event);
          e.relay = this.ndkRelay;
          const subFilters = this.activeSubscriptions.get(sub);
          subFilters?.eventReceived(e);
        });
        sub.on("eose", () => {
          const subFilters = this.activeSubscriptions.get(sub);
          subFilters?.eoseReceived(this.ndkRelay);
        });
        groupedSubscriptions.once("close", () => {
          sub.unsub();
          this.activeSubscriptions.delete(sub);
          if (groupableId) {
            this.activeSubscriptionsByGroupId.delete(groupableId);
          }
        });
        this.executeSubscriptionsWhenConnected(groupableId, groupedSubscriptions, mergedFilters);
        return sub;
      }
      executedFilters() {
        const ret = /* @__PURE__ */ new Map();
        for (const [, groupedSubscriptions] of this.activeSubscriptions) {
          ret.set(
            groupedSubscriptions.req,
            groupedSubscriptions.map((sub) => sub.subscription)
          );
        }
        return ret;
      }
    };
    var NDKRelay = class extends lib$1.EventEmitter {
      url;
      scores;
      connectivity;
      subs;
      publisher;
      authPolicy;
      authRequired = false;
      /**
       * Whether this relay is trusted.
       *
       * Trusted relay's events do not get their signature verified.
       */
      trusted = false;
      complaining = false;
      debug;
      constructor(url, authPolicy) {
        super();
        this.url = url;
        this.scores = /* @__PURE__ */ new Map();
        this.debug = debug3(`ndk:relay:${url}`);
        this.connectivity = new NDKRelayConnectivity(this);
        this.subs = new NDKRelaySubscriptions(this);
        this.publisher = new NDKRelayPublisher(this);
        this.authPolicy = authPolicy;
      }
      get status() {
        return this.connectivity.status;
      }
      get connectionStats() {
        return this.connectivity.connectionStats;
      }
      /**
       * Connects to the relay.
       */
      async connect() {
        return this.connectivity.connect();
      }
      /**
       * Disconnects from the relay.
       */
      disconnect() {
        if (this.status === 3 /* DISCONNECTED */) {
          return;
        }
        this.connectivity.disconnect();
      }
      /**
       * Queues or executes the subscription of a specific set of filters
       * within this relay.
       *
       * @param subscription NDKSubscription this filters belong to.
       * @param filters Filters to execute
       */
      subscribe(subscription, filters) {
        this.subs.subscribe(subscription, filters);
      }
      /**
       * Publishes an event to the relay with an optional timeout.
       *
       * If the relay is not connected, the event will be published when the relay connects,
       * unless the timeout is reached before the relay connects.
       *
       * @param event The event to publish
       * @param timeoutMs The timeout for the publish operation in milliseconds
       * @returns A promise that resolves when the event has been published or rejects if the operation times out
       */
      async publish(event, timeoutMs = 2500) {
        return this.publisher.publish(event, timeoutMs);
      }
      async auth(event) {
        return this.publisher.auth(event);
      }
      /**
       * Called when this relay has responded with an event but
       * wasn't the fastest one.
       * @param timeDiffInMs The time difference in ms between the fastest and this relay in milliseconds
       */
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      scoreSlowerEvent(timeDiffInMs) {
      }
      /** @deprecated Use referenceTags instead. */
      tagReference(marker) {
        const tag = ["r", this.url];
        if (marker) {
          tag.push(marker);
        }
        return tag;
      }
      referenceTags() {
        return [["r", this.url]];
      }
      activeSubscriptions() {
        return this.subs.executedFilters();
      }
    };

    // src/relay/sets/index.ts
    var PublishError = class extends Error {
      errors;
      constructor(message, errors) {
        super(message);
        this.errors = errors;
      }
    };
    var NDKRelaySet = class _NDKRelaySet {
      relays;
      debug;
      ndk;
      constructor(relays, ndk) {
        this.relays = relays;
        this.ndk = ndk;
        this.debug = ndk.debug.extend("relayset");
      }
      /**
       * Adds a relay to this set.
       */
      addRelay(relay) {
        this.relays.add(relay);
      }
      /**
       * Creates a relay set from a list of relay URLs.
       *
       * If no connection to the relay is found in the pool it will temporarily
       * connect to it.
       *
       * @param relayUrls - list of relay URLs to include in this set
       * @param ndk
       * @returns NDKRelaySet
       */
      static fromRelayUrls(relayUrls, ndk) {
        const relays = /* @__PURE__ */ new Set();
        for (const url of relayUrls) {
          const relay = ndk.pool.relays.get(url);
          if (relay) {
            relays.add(relay);
          } else {
            const temporaryRelay = new NDKRelay(url);
            ndk.pool.useTemporaryRelay(temporaryRelay);
            relays.add(temporaryRelay);
          }
        }
        return new _NDKRelaySet(new Set(relays), ndk);
      }
      /**
       * Publish an event to all relays in this set. Returns the number of relays that have received the event.
       * @param event
       * @param timeoutMs - timeout in milliseconds for each publish operation and connection operation
       * @returns A set where the event was successfully published to
       */
      async publish(event, timeoutMs) {
        const publishedToRelays = /* @__PURE__ */ new Set();
        const errors = /* @__PURE__ */ new Map();
        const isEphemeral2 = event.isEphemeral();
        const promises = Array.from(this.relays).map((relay) => {
          return new Promise((resolve) => {
            relay.publish(event, timeoutMs).then(() => {
              publishedToRelays.add(relay);
              resolve();
            }).catch((err) => {
              if (!isEphemeral2) {
                errors.set(relay, err);
                this.debug("error publishing to relay", {
                  relay: relay.url,
                  err
                });
              }
              resolve();
            });
          });
        });
        await Promise.all(promises);
        if (publishedToRelays.size === 0) {
          if (!isEphemeral2) {
            throw new PublishError("No relay was able to receive the event", errors);
          }
        }
        return publishedToRelays;
      }
      size() {
        return this.relays.size;
      }
    };

    // src/relay/sets/calculate.ts
    function calculateRelaySetFromEvent(ndk, event) {
      const relays = /* @__PURE__ */ new Set();
      ndk.pool?.relays.forEach((relay) => relays.add(relay));
      return new NDKRelaySet(relays, ndk);
    }
    function getWriteRelaysFor(ndk, author) {
      if (!ndk.outboxTracker)
        return void 0;
      return ndk.outboxTracker.data.get(author)?.writeRelays;
    }
    function calculateRelaySetsFromFilter(ndk, filters) {
      const result = /* @__PURE__ */ new Map();
      const authors = /* @__PURE__ */ new Set();
      filters.forEach((filter) => {
        if (filter.authors) {
          filter.authors.forEach((author) => authors.add(author));
        }
      });
      if (authors.size > 0) {
        const authorToRelaysMap = /* @__PURE__ */ new Map();
        for (const author of authors) {
          const userWriteRelays = getWriteRelaysFor(ndk, author);
          if (userWriteRelays && userWriteRelays.size > 0) {
            ndk.debug(`Adding ${userWriteRelays.size} relays for ${author}`);
            userWriteRelays.forEach((relay) => {
              const authorsInRelay = authorToRelaysMap.get(relay) || [];
              authorsInRelay.push(author);
              authorToRelaysMap.set(relay, authorsInRelay);
            });
          } else {
            ndk.explicitRelayUrls?.forEach((relay) => {
              const authorsInRelay = authorToRelaysMap.get(relay) || [];
              authorsInRelay.push(author);
              authorToRelaysMap.set(relay, authorsInRelay);
            });
          }
        }
        for (const relayUrl of authorToRelaysMap.keys()) {
          result.set(relayUrl, []);
        }
        for (const filter of filters) {
          if (filter.authors) {
            for (const [relayUrl, authors2] of authorToRelaysMap.entries()) {
              const authorFilterAndRelayPubkeyIntersection = filter.authors.filter(
                (author) => authors2.includes(author)
              );
              result.set(relayUrl, [
                ...result.get(relayUrl),
                {
                  ...filter,
                  // Overwrite authors sent to this relay with the authors that were
                  // present in the filter and are also present in the relay
                  authors: authorFilterAndRelayPubkeyIntersection
                }
              ]);
            }
          } else {
            for (const relayUrl of authorToRelaysMap.keys()) {
              result.set(relayUrl, [...result.get(relayUrl), filter]);
            }
          }
        }
      } else {
        ndk.explicitRelayUrls?.forEach((relay) => {
          result.set(relay, filters);
        });
      }
      return result;
    }
    function calculateRelaySetsFromFilters(ndk, filters) {
      return calculateRelaySetsFromFilter(ndk, filters);
    }
    var DEFAULT_RELAYS = [
      "wss://nos.lol",
      "wss://relay.nostr.band",
      "wss://relay.f7z.io",
      "wss://relay.damus.io",
      "wss://nostr.mom",
      "wss://no.str.cr"
    ];
    var Zap = class extends lib$1.EventEmitter {
      ndk;
      zappedEvent;
      zappedUser;
      constructor(args) {
        super();
        this.ndk = args.ndk;
        this.zappedEvent = args.zappedEvent;
        this.zappedUser = args.zappedUser || this.ndk.getUser({ hexpubkey: this.zappedEvent?.pubkey });
      }
      async getZapEndpoint() {
        let lud06;
        let lud16;
        let zapEndpoint;
        let zapEndpointCallback;
        if (this.zappedUser) {
          if (!this.zappedUser.profile) {
            await this.zappedUser.fetchProfile({ groupable: false });
          }
          lud06 = (this.zappedUser.profile || {}).lud06;
          lud16 = (this.zappedUser.profile || {}).lud16;
        }
        if (lud16 && !lud16.startsWith("LNURL")) {
          const [name, domain] = lud16.split("@");
          zapEndpoint = `https://${domain}/.well-known/lnurlp/${name}`;
        } else if (lud06) {
          const { words } = bech32.decode(lud06, 1e3);
          const data = bech32.fromWords(words);
          const utf8Decoder = new TextDecoder("utf-8");
          zapEndpoint = utf8Decoder.decode(data);
        }
        if (!zapEndpoint) {
          throw new Error("No zap endpoint found");
        }
        try {
          const _fetch = this.ndk.httpFetch || fetch;
          const response = await _fetch(zapEndpoint);
          if (response.status !== 200) {
            const text = await response.text();
            throw new Error(`Unable to fetch zap endpoint ${zapEndpoint}: ${text}`);
          }
          const body = await response.json();
          if (body?.allowsNostr && (body?.nostrPubkey || body?.nostrPubKey)) {
            zapEndpointCallback = body.callback;
          }
          return zapEndpointCallback;
        } catch (e) {
          throw new Error(`Unable to fetch zap endpoint ${zapEndpoint}: ${e}`);
        }
      }
      /**
       * Generates a kind:9734 zap request and returns the payment request
       * @param amount amount to zap in millisatoshis
       * @param comment optional comment to include in the zap request
       * @param extraTags optional extra tags to include in the zap request
       * @param relays optional relays to ask zapper to publish the zap to
       * @returns the payment request
       */
      async createZapRequest(amount, comment, extraTags, relays, signer) {
        const res = await this.generateZapRequest(amount, comment, extraTags, relays);
        if (!res)
          return null;
        const { event, zapEndpoint } = res;
        if (!event) {
          throw new Error("No zap request event found");
        }
        await event.sign(signer);
        let invoice;
        try {
          invoice = await this.getInvoice(event, amount, zapEndpoint);
        } catch (e) {
          throw new Error("Failed to get invoice: " + e);
        }
        return invoice;
      }
      async getInvoice(event, amount, zapEndpoint) {
        const response = await fetch(
          `${zapEndpoint}?` + new URLSearchParams({
            amount: amount.toString(),
            nostr: JSON.stringify(event.rawEvent())
          })
        );
        const body = await response.json();
        return body.pr;
      }
      async generateZapRequest(amount, comment, extraTags, relays, signer) {
        const zapEndpoint = await this.getZapEndpoint();
        if (!zapEndpoint) {
          throw new Error("No zap endpoint found");
        }
        if (!this.zappedEvent && !this.zappedUser)
          throw new Error("No zapped event or user found");
        const zapRequest = nip57_exports.makeZapRequest({
          profile: this.zappedUser.pubkey,
          // set the event to null since nostr-tools doesn't support nip-33 zaps
          event: null,
          amount,
          comment: comment || "",
          relays: relays ?? this.relays()
        });
        if (this.zappedEvent) {
          const tags = this.zappedEvent.referenceTags();
          zapRequest.tags.push(...tags);
        }
        zapRequest.tags.push(["lnurl", zapEndpoint]);
        const event = new NDKEvent(this.ndk, zapRequest);
        if (extraTags) {
          event.tags = event.tags.concat(extraTags);
        }
        return { event, zapEndpoint };
      }
      /**
       * @returns the relays to use for the zap request
       */
      relays() {
        let r = [];
        if (this.ndk?.pool?.relays) {
          r = this.ndk.pool.urls();
        }
        if (!r.length) {
          r = DEFAULT_RELAYS;
        }
        return r;
      }
    };
    function mergeTags(tags1, tags2) {
      const tagMap = /* @__PURE__ */ new Map();
      const generateKey = (tag) => tag.join(",");
      const isContained = (smaller, larger) => {
        return smaller.every((value, index) => value === larger[index]);
      };
      const processTag = (tag) => {
        for (let [key, existingTag] of tagMap) {
          if (isContained(existingTag, tag) || isContained(tag, existingTag)) {
            if (tag.length >= existingTag.length) {
              tagMap.set(key, tag);
            }
            return;
          }
        }
        tagMap.set(generateKey(tag), tag);
      };
      tags1.concat(tags2).forEach(processTag);
      return Array.from(tagMap.values());
    }
    async function generateContentTags(content, tags = []) {
      const tagRegex = /(@|nostr:)(npub|nprofile|note|nevent|naddr)[a-zA-Z0-9]+/g;
      const hashtagRegex = /#(\w+)/g;
      let promises = [];
      const addTagIfNew = (t) => {
        if (!tags.find((t2) => t2[0] === t[0] && t2[1] === t[1])) {
          tags.push(t);
        }
      };
      content = content.replace(tagRegex, (tag) => {
        try {
          const entity = tag.split(/(@|nostr:)/)[2];
          const { type, data } = nip19_exports.decode(entity);
          let t;
          switch (type) {
            case "npub":
              t = ["p", data];
              break;
            case "nprofile":
              t = ["p", data.pubkey];
              break;
            case "note":
              promises.push(
                new Promise(async (resolve) => {
                  addTagIfNew([
                    "e",
                    data,
                    await maybeGetEventRelayUrl(entity),
                    "mention"
                  ]);
                  resolve();
                })
              );
              break;
            case "nevent":
              promises.push(
                new Promise(async (resolve) => {
                  let { id, relays, author } = data;
                  if (!relays || relays.length === 0) {
                    relays = [await maybeGetEventRelayUrl(entity)];
                  }
                  addTagIfNew(["e", id, relays[0], "mention"]);
                  if (author)
                    addTagIfNew(["p", author]);
                  resolve();
                })
              );
              break;
            case "naddr":
              promises.push(
                new Promise(async (resolve) => {
                  const id = [data.kind, data.pubkey, data.identifier].join(":");
                  let relays = data.relays ?? [];
                  if (relays.length === 0) {
                    relays = [await maybeGetEventRelayUrl(entity)];
                  }
                  addTagIfNew(["a", id, relays[0], "mention"]);
                  addTagIfNew(["p", data.pubkey]);
                  resolve();
                })
              );
              break;
            default:
              return tag;
          }
          if (t)
            addTagIfNew(t);
          return `nostr:${entity}`;
        } catch (error) {
          return tag;
        }
      });
      await Promise.all(promises);
      content = content.replace(hashtagRegex, (tag, word) => {
        const t = ["t", word];
        if (!tags.find((t2) => t2[0] === t[0] && t2[1] === t[1])) {
          tags.push(t);
        }
        return tag;
      });
      return { content, tags };
    }
    async function maybeGetEventRelayUrl(nip19Id) {
      return "";
    }

    // src/events/kind.ts
    function isReplaceable() {
      if (this.kind === void 0)
        throw new Error("Kind not set");
      return this.kind >= 1e4 && this.kind < 2e4;
    }
    function isEphemeral() {
      if (this.kind === void 0)
        throw new Error("Kind not set");
      return this.kind >= 2e4 && this.kind < 3e4;
    }
    function isParamReplaceable() {
      if (this.kind === void 0)
        throw new Error("Kind not set");
      return this.kind >= 3e4 && this.kind < 4e4;
    }

    // src/events/nip04.ts
    async function encrypt(recipient, signer) {
      if (!this.ndk)
        throw new Error("No NDK instance found!");
      if (!signer) {
        await this.ndk.assertSigner();
        signer = this.ndk.signer;
      }
      if (!recipient) {
        const pTags = this.getMatchingTags("p");
        if (pTags.length !== 1) {
          throw new Error(
            "No recipient could be determined and no explicit recipient was provided"
          );
        }
        recipient = this.ndk.getUser({ hexpubkey: pTags[0][1] });
      }
      this.content = await signer?.encrypt(recipient, this.content);
    }
    async function decrypt(sender, signer) {
      if (!this.ndk)
        throw new Error("No NDK instance found!");
      if (!signer) {
        await this.ndk.assertSigner();
        signer = this.ndk.signer;
      }
      if (!sender) {
        sender = this.author;
      }
      this.content = await signer?.decrypt(sender, this.content);
    }
    function encode() {
      if (this.isParamReplaceable()) {
        return nip19_exports.naddrEncode({
          kind: this.kind,
          pubkey: this.pubkey,
          identifier: this.replaceableDTag(),
          relays: this.relay ? [this.relay.url] : []
        });
      } else if (this.relay) {
        return nip19_exports.neventEncode({
          id: this.tagId(),
          relays: [this.relay.url],
          author: this.pubkey
        });
      } else {
        return nip19_exports.noteEncode(this.tagId());
      }
    }

    // src/events/repost.ts
    async function repost(publish = true, signer) {
      if (!signer && publish) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        this.ndk.assertSigner();
        signer = this.ndk.signer;
      }
      const e = new NDKEvent(this.ndk, {
        kind: getKind(this),
        content: ""
      });
      e.tag(this);
      if (e.kind === 16 /* GenericRepost */) {
        e.tags.push(["k", `${this.kind}`]);
      }
      if (signer)
        await e.sign(signer);
      if (publish)
        await e.publish();
      return e;
    }
    function getKind(event) {
      if (event.kind === 1) {
        return 6 /* Repost */;
      }
      return 16 /* GenericRepost */;
    }

    // src/events/index.ts
    var NDKEvent = class _NDKEvent extends lib$1.EventEmitter {
      ndk;
      created_at;
      content = "";
      tags = [];
      kind;
      id = "";
      sig;
      pubkey = "";
      _author = void 0;
      /**
       * The relay that this event was first received from.
       */
      relay;
      constructor(ndk, event) {
        super();
        this.ndk = ndk;
        this.created_at = event?.created_at;
        this.content = event?.content || "";
        this.tags = event?.tags || [];
        this.id = event?.id || "";
        this.sig = event?.sig;
        this.pubkey = event?.pubkey || "";
        this.kind = event?.kind;
      }
      /**
       * Returns the event as is.
       */
      rawEvent() {
        return {
          created_at: this.created_at,
          content: this.content,
          tags: this.tags,
          kind: this.kind,
          pubkey: this.pubkey,
          id: this.id,
          sig: this.sig
        };
      }
      set author(user) {
        this.pubkey = user.hexpubkey;
        this._author = void 0;
      }
      /**
       * Returns an NDKUser for the author of the event.
       */
      get author() {
        if (this._author)
          return this._author;
        if (!this.ndk)
          throw new Error("No NDK instance found");
        const user = this.ndk.getUser({ hexpubkey: this.pubkey });
        this._author = user;
        return user;
      }
      tag(userOrTagOrEvent, marker) {
        let tags = [];
        if (userOrTagOrEvent instanceof NDKUser) {
          const tag = ["p", userOrTagOrEvent.pubkey];
          if (marker)
            tag.push(marker);
          tags.push(tag);
        } else if (userOrTagOrEvent instanceof _NDKEvent) {
          const event = userOrTagOrEvent;
          const skipAuthorTag = event?.pubkey === this.pubkey;
          tags = event.referenceTags(marker, skipAuthorTag);
          for (const pTag of event.getMatchingTags("p")) {
            if (pTag[1] === this.pubkey)
              continue;
            if (this.tags.find((t) => t[0] === "p" && t[1] === pTag[1]))
              continue;
            this.tags.push(["p", pTag[1]]);
          }
        } else {
          tags = [userOrTagOrEvent];
        }
        this.tags = mergeTags(this.tags, tags);
      }
      /**
       * Return a NostrEvent object, trying to fill in missing fields
       * when possible, adding tags when necessary.
       * @param pubkey {string} The pubkey of the user who the event belongs to.
       * @returns {Promise<NostrEvent>} A promise that resolves to a NostrEvent.
       */
      async toNostrEvent(pubkey) {
        if (!pubkey && this.pubkey === "") {
          const user = await this.ndk?.signer?.user();
          this.pubkey = user?.hexpubkey || "";
        }
        if (!this.created_at)
          this.created_at = Math.floor(Date.now() / 1e3);
        const nostrEvent = this.rawEvent();
        const { content, tags } = await this.generateTags();
        nostrEvent.content = content || "";
        nostrEvent.tags = tags;
        try {
          this.id = getEventHash(nostrEvent);
        } catch (e) {
        }
        if (this.id)
          nostrEvent.id = this.id;
        if (this.sig)
          nostrEvent.sig = this.sig;
        return nostrEvent;
      }
      isReplaceable = isReplaceable.bind(this);
      isEphemeral = isEphemeral.bind(this);
      isParamReplaceable = isParamReplaceable.bind(this);
      /**
       * Encodes a bech32 id.
       *
       * @returns {string} - Encoded naddr, note or nevent.
       */
      encode = encode.bind(this);
      encrypt = encrypt.bind(this);
      decrypt = decrypt.bind(this);
      /**
       * Get all tags with the given name
       * @param tagName {string} The name of the tag to search for
       * @returns {NDKTag[]} An array of the matching tags
       */
      getMatchingTags(tagName) {
        return this.tags.filter((tag) => tag[0] === tagName);
      }
      /**
       * Get the first tag with the given name
       * @param tagName Tag name to search for
       * @returns The value of the first tag with the given name, or undefined if no such tag exists
       */
      tagValue(tagName) {
        const tags = this.getMatchingTags(tagName);
        if (tags.length === 0)
          return void 0;
        return tags[0][1];
      }
      /**
       * Gets the NIP-31 "alt" tag of the event.
       */
      get alt() {
        return this.tagValue("alt");
      }
      /**
       * Sets the NIP-31 "alt" tag of the event. Use this to set an alt tag so
       * clients that don't handle a particular event kind can display something
       * useful for users.
       */
      set alt(alt) {
        this.removeTag("alt");
        if (alt)
          this.tags.push(["alt", alt]);
      }
      /**
       * Remove all tags with the given name (e.g. "d", "a", "p")
       * @param tagName Tag name to search for and remove
       * @returns {void}
       */
      removeTag(tagName) {
        this.tags = this.tags.filter((tag) => tag[0] !== tagName);
      }
      /**
       * Sign the event if a signer is present.
       *
       * It will generate tags.
       * Repleacable events will have their created_at field set to the current time.
       * @param signer {NDKSigner} The NDKSigner to use to sign the event
       * @returns {Promise<string>} A Promise that resolves to the signature of the signed event.
       */
      async sign(signer) {
        if (!signer) {
          this.ndk?.assertSigner();
          signer = this.ndk.signer;
        } else {
          this.author = await signer.user();
        }
        await this.generateTags();
        if (this.isReplaceable()) {
          this.created_at = Math.floor(Date.now() / 1e3);
        }
        const nostrEvent = await this.toNostrEvent();
        this.sig = await signer.sign(nostrEvent);
        return this.sig;
      }
      /**
       * Attempt to sign and then publish an NDKEvent to a given relaySet.
       * If no relaySet is provided, the relaySet will be calculated by NDK.
       * @param relaySet {NDKRelaySet} The relaySet to publish the even to.
       * @returns A promise that resolves to the relays the event was published to.
       */
      async publish(relaySet, timeoutMs) {
        if (!this.sig)
          await this.sign();
        if (!this.ndk)
          throw new Error("NDKEvent must be associated with an NDK instance to publish");
        if (!relaySet) {
          relaySet = this.ndk.devWriteRelaySet || calculateRelaySetFromEvent(this.ndk);
        }
        return relaySet.publish(this, timeoutMs);
      }
      /**
       * Generates tags for users, notes, and other events tagged in content.
       * Will also generate random "d" tag for parameterized replaceable events where needed.
       * @returns {ContentTag} The tags and content of the event.
       */
      async generateTags() {
        let tags = [];
        const g = await generateContentTags(this.content, this.tags);
        const content = g.content;
        tags = g.tags;
        if (this.kind && this.isParamReplaceable()) {
          const dTag = this.getMatchingTags("d")[0];
          if (!dTag) {
            const title = this.tagValue("title");
            const randLength = title ? 6 : 16;
            let str = [...Array(randLength)].map(() => Math.random().toString(36)[2]).join("");
            if (title && title.length > 0) {
              str = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + "-" + str;
            }
            tags.push(["d", str]);
          }
        }
        if ((this.ndk?.clientName || this.ndk?.clientNip89) && !this.tagValue("client")) {
          const clientTag = ["client", this.ndk.clientName ?? ""];
          if (this.ndk.clientNip89)
            clientTag.push(this.ndk.clientNip89);
          tags.push(clientTag);
        }
        return { content: content || "", tags };
      }
      muted() {
        const authorMutedEntry = this.ndk?.mutedIds.get(this.pubkey);
        if (authorMutedEntry && authorMutedEntry === "p")
          return "author";
        const eventTagReference = this.tagReference();
        const eventMutedEntry = this.ndk?.mutedIds.get(eventTagReference[1]);
        if (eventMutedEntry && eventMutedEntry === eventTagReference[0])
          return "event";
        return null;
      }
      /**
       * Returns the "d" tag of a parameterized replaceable event or throws an error if the event isn't
       * a parameterized replaceable event.
       * @returns {string} the "d" tag of the event.
       */
      replaceableDTag() {
        if (this.kind && this.kind >= 3e4 && this.kind <= 4e4) {
          const dTag = this.getMatchingTags("d")[0];
          const dTagId = dTag ? dTag[1] : "";
          return dTagId;
        }
        throw new Error("Event is not a parameterized replaceable event");
      }
      /**
       * Provides a deduplication key for the event.
       *
       * For kinds 0, 3, 10k-20k this will be the event <kind>:<pubkey>
       * For kinds 30k-40k this will be the event <kind>:<pubkey>:<d-tag>
       * For all other kinds this will be the event id
       */
      deduplicationKey() {
        if (this.kind === 0 || this.kind === 3 || this.kind && this.kind >= 1e4 && this.kind < 2e4) {
          return `${this.kind}:${this.pubkey}`;
        } else {
          return this.tagId();
        }
      }
      /**
       * Returns the id of the event or, if it's a parameterized event, the generated id of the event using "d" tag, pubkey, and kind.
       * @returns {string} The id
       */
      tagId() {
        if (this.isParamReplaceable()) {
          return this.tagAddress();
        }
        return this.id;
      }
      /**
       * Returns the "reference" value ("<kind>:<author-pubkey>:<d-tag>") for this replaceable event.
       * @returns {string} The id
       */
      tagAddress() {
        if (!this.isParamReplaceable()) {
          throw new Error("This must only be called on replaceable events");
        }
        const dTagId = this.replaceableDTag();
        return `${this.kind}:${this.pubkey}:${dTagId}`;
      }
      /**
       * Get the tag that can be used to reference this event from another event.
       *
       * Consider using referenceTags() instead (unless you have a good reason to use this)
       *
       * @example
       *     event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
       *     event.tagReference(); // ["a", "30000:pubkey:d-code"]
       *
       *     event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
       *     event.tagReference(); // ["e", "eventid"]
       * @returns {NDKTag} The NDKTag object referencing this event
       */
      tagReference(marker) {
        let tag;
        if (this.isParamReplaceable()) {
          tag = ["a", this.tagAddress()];
        } else {
          tag = ["e", this.tagId()];
        }
        if (this.relay) {
          tag.push(this.relay.url);
        } else {
          tag.push("");
        }
        if (marker) {
          tag.push(marker);
        }
        return tag;
      }
      /**
       * Get the tags that can be used to reference this event from another event
       * @param marker The marker to use in the tag
       * @example
       *     event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
       *     event.referenceTags(); // [["a", "30000:pubkey:d-code"], ["e", "parent-id"]]
       *
       *     event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
       *     event.referenceTags(); // [["e", "parent-id"]]
       * @returns {NDKTag} The NDKTag object referencing this event
       */
      referenceTags(marker, skipAuthorTag) {
        let tags = [];
        if (this.isParamReplaceable()) {
          tags = [
            ["a", this.tagAddress()],
            ["e", this.id]
          ];
        } else {
          tags = [["e", this.id]];
        }
        if (this.relay?.url) {
          tags = tags.map((tag) => {
            tag.push(this.relay?.url);
            return tag;
          });
        } else if (marker) {
          tags = tags.map((tag) => {
            tag.push("");
            return tag;
          });
        }
        if (marker) {
          tags.forEach((tag) => tag.push(marker));
        }
        if (!skipAuthorTag)
          tags.push(...this.author.referenceTags());
        return tags;
      }
      /**
       * Provides the filter that will return matching events for this event.
       *
       * @example
       *    event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
       *    event.filter(); // { "#a": ["30000:pubkey:d-code"] }
       * @example
       *    event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
       *    event.filter(); // { "#e": ["eventid"] }
       *
       * @returns The filter that will return matching events for this event
       */
      filter() {
        if (this.isParamReplaceable()) {
          return { "#a": [this.tagId()] };
        } else {
          return { "#e": [this.tagId()] };
        }
      }
      /**
       * Create a zap request for an existing event
       *
       * @param amount The amount to zap in millisatoshis
       * @param comment A comment to add to the zap request
       * @param extraTags Extra tags to add to the zap request
       * @param recipient The zap recipient (optional for events)
       * @param signer The signer to use (will default to the NDK instance's signer)
       */
      async zap(amount, comment, extraTags, recipient, signer) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        if (!signer) {
          this.ndk.assertSigner();
        }
        const zap = new Zap({
          ndk: this.ndk,
          zappedEvent: this,
          zappedUser: recipient
        });
        const relays = Array.from(this.ndk.pool.relays.keys());
        const paymentRequest = await zap.createZapRequest(
          amount,
          comment,
          extraTags,
          relays,
          signer
        );
        return paymentRequest;
      }
      /**
       * Generates a deletion event of the current event
       *
       * @param reason The reason for the deletion
       * @returns The deletion event
       */
      async delete(reason) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        this.ndk.assertSigner();
        const e = new _NDKEvent(this.ndk, {
          kind: 5 /* EventDeletion */,
          content: reason || ""
        });
        e.tag(this);
        await e.publish();
        return e;
      }
      /**
       * NIP-18 reposting event.
       *
       * @param publish Whether to publish the reposted event automatically
       * @param signer The signer to use for signing the reposted event
       * @returns The reposted event
       *
       * @function
       */
      repost = repost.bind(this);
      /**
       * React to an existing event
       *
       * @param content The content of the reaction
       */
      async react(content, publish = true) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        this.ndk.assertSigner();
        const e = new _NDKEvent(this.ndk, {
          kind: 7 /* Reaction */,
          content
        });
        e.tag(this);
        if (publish) {
          await e.publish();
        } else {
          await e.sign();
        }
        return e;
      }
      /**
       * Checks whether the event is valid per underlying NIPs.
       *
       * This method is meant to be overridden by subclasses that implement specific NIPs
       * to allow the enforcement of NIP-specific validation rules.
       *
       *
       */
      get isValid() {
        return true;
      }
    };

    // src/events/kinds/NDKRelayList.ts
    var READ_MARKER = "read";
    var WRITE_MARKER = "write";
    var NDKRelayList = class _NDKRelayList extends NDKEvent {
      constructor(ndk, rawEvent) {
        super(ndk, rawEvent);
        this.kind ??= 10002 /* RelayList */;
      }
      static from(ndkEvent) {
        return new _NDKRelayList(ndkEvent.ndk, ndkEvent.rawEvent());
      }
      get readRelayUrls() {
        return this.getMatchingTags("r").filter((tag) => !tag[2] || tag[2] && tag[2] === READ_MARKER).map((tag) => tag[1]);
      }
      set readRelayUrls(relays) {
        for (const relay of relays) {
          this.tags.push(["r", relay, READ_MARKER]);
        }
      }
      get writeRelayUrls() {
        return this.getMatchingTags("r").filter((tag) => !tag[2] || tag[2] && tag[2] === WRITE_MARKER).map((tag) => tag[1]);
      }
      set writeRelayUrls(relays) {
        for (const relay of relays) {
          this.tags.push(["r", relay, WRITE_MARKER]);
        }
      }
      get bothRelayUrls() {
        return this.getMatchingTags("r").filter((tag) => !tag[2]).map((tag) => tag[1]);
      }
      set bothRelayUrls(relays) {
        for (const relay of relays) {
          this.tags.push(["r", relay]);
        }
      }
      get relays() {
        return this.getMatchingTags("r").map((tag) => tag[1]);
      }
    };
    var defaultOpts = {
      closeOnEose: false,
      cacheUsage: "CACHE_FIRST" /* CACHE_FIRST */,
      groupable: true,
      groupableDelay: 100,
      groupableDelayType: "at-most"
    };
    var NDKSubscription = class extends lib$1.EventEmitter {
      subId;
      filters;
      opts;
      pool;
      skipVerification = false;
      skipValidation = false;
      /**
       * Tracks the filters as they are executed on each relay
       */
      relayFilters;
      relaySet;
      ndk;
      debug;
      eoseDebug;
      /**
       * Events that have been seen by the subscription, with the time they were first seen.
       */
      eventFirstSeen = /* @__PURE__ */ new Map();
      /**
       * Relays that have sent an EOSE.
       */
      eosesSeen = /* @__PURE__ */ new Set();
      /**
       * Events that have been seen by the subscription per relay.
       */
      eventsPerRelay = /* @__PURE__ */ new Map();
      /**
       * The time the last event was received by the subscription.
       * This is used to calculate when EOSE should be emitted.
       */
      lastEventReceivedAt;
      internalId;
      constructor(ndk, filters, opts, relaySet, subId) {
        super();
        this.ndk = ndk;
        this.pool = opts?.pool || ndk.pool;
        this.opts = { ...defaultOpts, ...opts || {} };
        this.filters = filters instanceof Array ? filters : [filters];
        this.subId = subId || opts?.subId;
        this.internalId = Math.random().toString(36).substring(7);
        this.relaySet = relaySet;
        this.debug = ndk.debug.extend(`subscription[${opts?.subId ?? this.internalId}]`);
        this.eoseDebug = this.debug.extend("eose");
        this.skipVerification = opts?.skipVerification || false;
        this.skipValidation = opts?.skipValidation || false;
        if (!this.opts.closeOnEose) {
          this.debug(
            `Creating a permanent subscription`,
            this.opts,
            JSON.stringify(this.filters)
          );
        }
        if (this.opts.cacheUsage === "ONLY_CACHE" /* ONLY_CACHE */ && !this.opts.closeOnEose) {
          throw new Error("Cannot use cache-only options with a persistent subscription");
        }
      }
      /**
       * Provides access to the first filter of the subscription for
       * backwards compatibility.
       */
      get filter() {
        return this.filters[0];
      }
      isGroupable() {
        return this.opts?.groupable || false;
      }
      shouldQueryCache() {
        return this.opts?.cacheUsage !== "ONLY_RELAY" /* ONLY_RELAY */;
      }
      shouldQueryRelays() {
        return this.opts?.cacheUsage !== "ONLY_CACHE" /* ONLY_CACHE */;
      }
      shouldWaitForCache() {
        return (
          // Must want to close on EOSE; subscriptions
          // that want to receive further updates must
          // always hit the relay
          this.opts.closeOnEose && // Cache adapter must claim to be fast
          !!this.ndk.cacheAdapter?.locking && // If explicitly told to run in parallel, then
          // we should not wait for the cache
          this.opts.cacheUsage !== "PARALLEL" /* PARALLEL */
        );
      }
      /**
       * Start the subscription. This is the main method that should be called
       * after creating a subscription.
       */
      async start() {
        let cachePromise;
        if (this.shouldQueryCache()) {
          cachePromise = this.startWithCache();
          if (this.shouldWaitForCache()) {
            await cachePromise;
            if (queryFullyFilled(this)) {
              this.emit("eose", this);
              return;
            }
          }
        }
        if (this.shouldQueryRelays()) {
          this.startWithRelays();
        } else {
          this.emit("eose", this);
        }
        return;
      }
      stop() {
        this.emit("close", this);
        this.removeAllListeners();
      }
      /**
       * @returns Whether the subscription has an authors filter.
       */
      hasAuthorsFilter() {
        return this.filters.some((f) => f.authors?.length);
      }
      async startWithCache() {
        if (this.ndk.cacheAdapter?.query) {
          const promise = this.ndk.cacheAdapter.query(this);
          if (this.ndk.cacheAdapter.locking) {
            await promise;
          }
        }
      }
      /**
       * Send REQ to relays
       */
      startWithRelays() {
        if (!this.relaySet) {
          this.relayFilters = calculateRelaySetsFromFilters(this.ndk, this.filters);
        } else {
          this.relayFilters = /* @__PURE__ */ new Map();
          for (const relay of this.relaySet.relays) {
            this.relayFilters.set(relay.url, this.filters);
          }
        }
        if (!this.relayFilters || this.relayFilters.size === 0) {
          this.debug(`No relays to subscribe to`, this.ndk.explicitRelayUrls);
          return;
        }
        for (const [relayUrl, filters] of this.relayFilters) {
          const relay = this.pool.getRelay(relayUrl);
          relay.subscribe(this, filters);
        }
      }
      // EVENT handling
      /**
       * Called when an event is received from a relay or the cache
       * @param event
       * @param relay
       * @param fromCache Whether the event was received from the cache
       */
      eventReceived(event, relay, fromCache = false) {
        if (relay)
          event.relay = relay;
        if (!relay)
          relay = event.relay;
        if (!this.skipValidation) {
          if (!event.isValid) {
            this.debug(`Event failed validation`, event);
            return;
          }
        }
        if (!fromCache && relay) {
          let events = this.eventsPerRelay.get(relay);
          if (!events) {
            events = /* @__PURE__ */ new Set();
            this.eventsPerRelay.set(relay, events);
          }
          events.add(event.id);
          const eventAlreadySeen = this.eventFirstSeen.has(event.id);
          if (eventAlreadySeen) {
            const timeSinceFirstSeen = Date.now() - (this.eventFirstSeen.get(event.id) || 0);
            relay.scoreSlowerEvent(timeSinceFirstSeen);
            this.emit("event:dup", event, relay, timeSinceFirstSeen, this);
            return;
          }
          if (this.ndk.cacheAdapter) {
            this.ndk.cacheAdapter.setEvent(event, this.filters, relay);
          }
          this.eventFirstSeen.set(event.id, Date.now());
        } else {
          this.eventFirstSeen.set(event.id, 0);
        }
        if (!event.ndk)
          event.ndk = this.ndk;
        this.emit("event", event, relay, this);
        this.lastEventReceivedAt = Date.now();
      }
      // EOSE handling
      eoseTimeout;
      eoseReceived(relay) {
        this.eosesSeen.add(relay);
        this.eoseDebug(`received from ${relay.url}`);
        let lastEventSeen = this.lastEventReceivedAt ? Date.now() - this.lastEventReceivedAt : void 0;
        const hasSeenAllEoses = this.eosesSeen.size === this.relayFilters?.size;
        const queryFilled = queryFullyFilled(this);
        if (queryFilled) {
          this.emit("eose");
          this.eoseDebug(`Query fully filled`);
          if (this.opts?.closeOnEose) {
            this.stop();
          }
        } else if (hasSeenAllEoses) {
          this.emit("eose");
          this.eoseDebug(`All EOSEs seen`);
          if (this.opts?.closeOnEose) {
            this.stop();
          }
        } else {
          let timeToWaitForNextEose = 1e3;
          const percentageOfRelaysThatHaveSentEose = this.eosesSeen.size / this.relayFilters.size;
          if (this.eosesSeen.size >= 2 && percentageOfRelaysThatHaveSentEose >= 0.5) {
            timeToWaitForNextEose = timeToWaitForNextEose * (1 - percentageOfRelaysThatHaveSentEose);
            if (this.eoseTimeout) {
              clearTimeout(this.eoseTimeout);
            }
            const sendEoseTimeout = () => {
              lastEventSeen = this.lastEventReceivedAt ? Date.now() - this.lastEventReceivedAt : void 0;
              if (lastEventSeen !== void 0 && lastEventSeen < 20) {
                this.eoseTimeout = setTimeout(sendEoseTimeout, timeToWaitForNextEose);
              } else {
                this.emit("eose");
                if (this.opts?.closeOnEose)
                  this.stop();
              }
            };
            this.eoseTimeout = setTimeout(sendEoseTimeout, timeToWaitForNextEose);
          }
        }
      }
    };

    // src/user/follows.ts
    async function follows(opts, outbox, kind = 3 /* Contacts */) {
      if (!this.ndk)
        throw new Error("NDK not set");
      const contactListEvent = Array.from(
        await this.ndk.fetchEvents(
          {
            kinds: [kind],
            authors: [this.pubkey]
          },
          opts || { groupable: false }
        )
      )[0];
      if (contactListEvent) {
        const pubkeys = /* @__PURE__ */ new Set();
        contactListEvent.tags.forEach((tag) => {
          if (tag[0] === "p") {
            try {
              pubkeys.add(tag[1]);
              if (outbox) {
                this.ndk?.outboxTracker?.trackUsers([tag[1]]);
              }
            } catch (e) {
            }
          }
        });
        return [...pubkeys].reduce((acc, pubkey) => {
          const user = new NDKUser({ pubkey });
          user.ndk = this.ndk;
          acc.add(user);
          return acc;
        }, /* @__PURE__ */ new Set());
      }
      return /* @__PURE__ */ new Set();
    }

    // src/user/profile.ts
    function profileFromEvent(event) {
      const profile = {};
      let payload;
      try {
        payload = JSON.parse(event.content);
      } catch (error) {
        throw new Error(`Failed to parse profile event: ${error}`);
      }
      Object.keys(payload).forEach((key) => {
        switch (key) {
          case "name":
            profile.name = payload.name;
            break;
          case "display_name":
            profile.displayName = payload.display_name;
            break;
          case "image":
          case "picture":
            profile.image = payload.image || payload.picture;
            break;
          case "banner":
            profile.banner = payload.banner;
            break;
          case "bio":
            profile.bio = payload.bio;
            break;
          case "nip05":
            profile.nip05 = payload.nip05;
            break;
          case "lud06":
            profile.lud06 = payload.lud06;
            break;
          case "lud16":
            profile.lud16 = payload.lud16;
            break;
          case "about":
            profile.about = payload.about;
            break;
          case "zapService":
            profile.zapService = payload.zapService;
            break;
          case "website":
            profile.website = payload.website;
            break;
          default:
            profile[key] = payload[key];
            break;
        }
      });
      return profile;
    }
    function serializeProfile(profile) {
      const payload = {};
      for (const [key, val] of Object.entries(profile)) {
        switch (key) {
          case "username":
          case "name":
            payload.name = val;
            break;
          case "displayName":
            payload.display_name = val;
            break;
          case "image":
          case "picture":
            payload.picture = val;
            break;
          case "bio":
          case "about":
            payload.about = val;
            break;
          default:
            payload[key] = val;
            break;
        }
      }
      return JSON.stringify(payload);
    }

    // src/events/kinds/lists/index.ts
    var NDKList = class _NDKList extends NDKEvent {
      _encryptedTags;
      /**
       * Stores the number of bytes the content was before decryption
       * to expire the cache when the content changes.
       */
      encryptedTagsLength;
      constructor(ndk, rawEvent) {
        super(ndk, rawEvent);
        this.kind ??= 30001 /* CategorizedBookmarkList */;
      }
      /**
       * Wrap a NDKEvent into a NDKList
       */
      static from(ndkEvent) {
        return new _NDKList(ndkEvent.ndk, ndkEvent.rawEvent());
      }
      /**
       * Returns the title of the list. Falls back on fetching the name tag value.
       */
      get title() {
        const titleTag = this.tagValue("title") || this.tagValue("name");
        if (this.kind === 3 /* Contacts */ && !titleTag) {
          return "Contacts";
        } else if (this.kind === 1e4 /* MuteList */ && !titleTag) {
          return "Mute";
        } else if (this.kind === 10001 /* PinList */ && !titleTag) {
          return "Pinned Notes";
        } else if (this.kind === 10002 /* RelayList */ && !titleTag) {
          return "Relay Metadata";
        } else if (this.kind === 10003 /* BookmarkList */ && !titleTag) {
          return "Bookmarks";
        } else if (this.kind === 10004 /* CommunityList */ && !titleTag) {
          return "Communities";
        } else if (this.kind === 10005 /* PublicChatList */ && !titleTag) {
          return "Public Chats";
        } else if (this.kind === 10006 /* BlockRelayList */ && !titleTag) {
          return "Blocked Relays";
        } else if (this.kind === 10007 /* SearchRelayList */ && !titleTag) {
          return "Search Relays";
        } else if (this.kind === 10015 /* InterestList */ && !titleTag) {
          return "Interests";
        } else if (this.kind === 10030 /* EmojiList */ && !titleTag) {
          return "Emojis";
        } else {
          return titleTag ?? this.tagValue("d");
        }
      }
      /**
       * Sets the title of the list.
       */
      set title(title) {
        this.removeTag("title");
        this.removeTag("name");
        if (title) {
          this.tags.push(["title", title]);
        } else {
          throw new Error("Title cannot be empty");
        }
      }
      /**
       * Returns the name of the list.
       * @deprecated Please use "title" instead.
       */
      get name() {
        const nameTag = this.tagValue("name");
        if (this.kind === 3 /* Contacts */ && !nameTag) {
          return "Contacts";
        } else if (this.kind === 1e4 /* MuteList */ && !nameTag) {
          return "Mute";
        } else if (this.kind === 10001 /* PinList */ && !nameTag) {
          return "Pinned Notes";
        } else if (this.kind === 10002 /* RelayList */ && !nameTag) {
          return "Relay Metadata";
        } else if (this.kind === 10003 /* BookmarkList */ && !nameTag) {
          return "Bookmarks";
        } else if (this.kind === 10004 /* CommunityList */ && !nameTag) {
          return "Communities";
        } else if (this.kind === 10005 /* PublicChatList */ && !nameTag) {
          return "Public Chats";
        } else if (this.kind === 10006 /* BlockRelayList */ && !nameTag) {
          return "Blocked Relays";
        } else if (this.kind === 10007 /* SearchRelayList */ && !nameTag) {
          return "Search Relays";
        } else if (this.kind === 10015 /* InterestList */ && !nameTag) {
          return "Interests";
        } else if (this.kind === 10030 /* EmojiList */ && !nameTag) {
          return "Emojis";
        } else {
          return nameTag ?? this.tagValue("d");
        }
      }
      /**
       * Sets the name of the list.
       * @deprecated Please use "title" instead. This method will use the `title` tag instead.
       */
      set name(name) {
        this.removeTag("name");
        if (name) {
          this.tags.push(["title", name]);
        } else {
          throw new Error("Name cannot be empty");
        }
      }
      /**
       * Returns the description of the list.
       */
      get description() {
        return this.tagValue("description");
      }
      /**
       * Sets the description of the list.
       */
      set description(name) {
        if (name) {
          this.tags.push(["description", name]);
        } else {
          this.removeTag("description");
        }
      }
      isEncryptedTagsCacheValid() {
        return !!(this._encryptedTags && this.encryptedTagsLength === this.content.length);
      }
      /**
       * Returns the decrypted content of the list.
       */
      async encryptedTags(useCache = true) {
        if (useCache && this.isEncryptedTagsCacheValid())
          return this._encryptedTags;
        if (!this.ndk)
          throw new Error("NDK instance not set");
        if (!this.ndk.signer)
          throw new Error("NDK signer not set");
        const user = await this.ndk.signer.user();
        try {
          if (this.content.length > 0) {
            try {
              const decryptedContent = await this.ndk.signer.decrypt(user, this.content);
              const a = JSON.parse(decryptedContent);
              if (a && a[0]) {
                this.encryptedTagsLength = this.content.length;
                return this._encryptedTags = a;
              }
              this.encryptedTagsLength = this.content.length;
              return this._encryptedTags = [];
            } catch (e) {
              console.log(`error decrypting ${this.content}`);
            }
          }
        } catch (e) {
        }
        return [];
      }
      /**
       * This method can be overriden to validate that a tag is valid for this list.
       *
       * (i.e. the NDKPersonList can validate that items are NDKUser instances)
       */
      validateTag(tagValue) {
        return true;
      }
      /**
       * Returns the unecrypted items in this list.
       */
      get items() {
        return this.tags.filter((t) => {
          return ![
            "d",
            "L",
            "l",
            "title",
            "name",
            "description",
            "summary",
            "image",
            "thumb",
            "alt",
            "expiration",
            "subject"
          ].includes(t[0]);
        });
      }
      /**
       * Adds a new item to the list.
       * @param relay Relay to add
       * @param mark Optional mark to add to the item
       * @param encrypted Whether to encrypt the item
       */
      async addItem(item, mark = void 0, encrypted = false) {
        if (!this.ndk)
          throw new Error("NDK instance not set");
        if (!this.ndk.signer)
          throw new Error("NDK signer not set");
        let tags;
        if (item instanceof NDKEvent) {
          tags = item.referenceTags();
        } else if (item instanceof NDKUser) {
          tags = item.referenceTags();
        } else if (item instanceof NDKRelay) {
          tags = item.referenceTags();
        } else if (Array.isArray(item)) {
          tags = [item];
        } else {
          throw new Error("Invalid object type");
        }
        if (mark)
          tags[0].push(mark);
        if (encrypted) {
          const user = await this.ndk.signer.user();
          const currentList = await this.encryptedTags();
          currentList.push(...tags);
          this._encryptedTags = currentList;
          this.encryptedTagsLength = this.content.length;
          this.content = JSON.stringify(currentList);
          await this.encrypt(user);
        } else {
          this.tags.push(...tags);
        }
        this.created_at = Math.floor(Date.now() / 1e3);
        this.emit("change");
      }
      /**
       * Removes an item from the list.
       *
       * @param index The index of the item to remove.
       * @param encrypted Whether to remove from the encrypted list or not.
       */
      async removeItem(index, encrypted) {
        if (!this.ndk)
          throw new Error("NDK instance not set");
        if (!this.ndk.signer)
          throw new Error("NDK signer not set");
        if (encrypted) {
          const user = await this.ndk.signer.user();
          const currentList = await this.encryptedTags();
          currentList.splice(index, 1);
          this._encryptedTags = currentList;
          this.encryptedTagsLength = this.content.length;
          this.content = JSON.stringify(currentList);
          await this.encrypt(user);
        } else {
          this.tags.splice(index, 1);
        }
        this.created_at = Math.floor(Date.now() / 1e3);
        this.emit("change");
        return this;
      }
    };
    var lists_default = NDKList;

    // src/user/pin.ts
    async function pin(event, pinEvent, publish) {
      const kind = 10001 /* PinList */;
      if (!this.ndk)
        throw new Error("No NDK instance found");
      this.ndk.assertSigner();
      if (!pinEvent) {
        const events = await this.ndk.fetchEvents(
          { kinds: [kind], authors: [this.pubkey] },
          { cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */ }
        );
        if (events.size > 0) {
          pinEvent = lists_default.from(Array.from(events)[0]);
        } else {
          pinEvent = new NDKEvent(this.ndk, {
            kind
          });
        }
      }
      pinEvent.tag(event);
      if (publish) {
        await pinEvent.publish();
      }
      return pinEvent;
    }

    // src/user/nip05.ts
    var NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w.-]+)$/;
    async function getNip05For(fullname, _fetch = fetch, fetchOpts = {}) {
      const match = fullname.match(NIP05_REGEX);
      if (!match)
        return null;
      const [_, name = "_", domain] = match;
      try {
        const res = await _fetch(
          `https://${domain}/.well-known/nostr.json?name=${name}`,
          fetchOpts
        );
        const { names, relays, nip46 } = parseNIP05Result(await res.json());
        const pubkey = names[name];
        return pubkey ? {
          pubkey,
          relays: relays?.[pubkey],
          nip46: nip46?.[pubkey]
        } : null;
      } catch (_e) {
        return null;
      }
    }
    function parseNIP05Result(json) {
      const result = {
        names: {}
      };
      for (const [name, pubkey] of Object.entries(json.names)) {
        if (typeof name === "string" && typeof pubkey === "string") {
          result.names[name] = pubkey;
        }
      }
      if (json.relays) {
        result.relays = {};
        for (const [pubkey, relays] of Object.entries(json.relays)) {
          if (typeof pubkey === "string" && Array.isArray(relays)) {
            result.relays[pubkey] = relays.filter(
              (relay) => typeof relay === "string"
            );
          }
        }
      }
      if (json.nip46) {
        result.nip46 = {};
        for (const [pubkey, nip46] of Object.entries(json.relays)) {
          if (typeof pubkey === "string" && Array.isArray(nip46)) {
            result.nip46[pubkey] = nip46.filter((relay) => typeof relay === "string");
          }
        }
      }
      return result;
    }

    // src/user/index.ts
    var NDKUser = class _NDKUser {
      ndk;
      profile;
      _npub;
      _pubkey;
      relayUrls = [];
      nip46Urls = [];
      constructor(opts) {
        if (opts.npub)
          this._npub = opts.npub;
        if (opts.hexpubkey)
          this._pubkey = opts.hexpubkey;
        if (opts.pubkey)
          this._pubkey = opts.pubkey;
        if (opts.relayUrls)
          this.relayUrls = opts.relayUrls;
        if (opts.nip46Urls)
          this.nip46Urls = opts.nip46Urls;
      }
      get npub() {
        if (!this._npub) {
          if (!this._pubkey)
            throw new Error("hexpubkey not set");
          this._npub = nip19_exports.npubEncode(this.pubkey);
        }
        return this._npub;
      }
      set npub(npub) {
        this._npub = npub;
      }
      /**
       * Get the user's hexpubkey
       * @returns {Hexpubkey} The user's hexpubkey
       *
       * @deprecated Use `pubkey` instead
       */
      get hexpubkey() {
        return this.pubkey;
      }
      /**
       * Set the user's hexpubkey
       * @param pubkey {Hexpubkey} The user's hexpubkey
       * @deprecated Use `pubkey` instead
       */
      set hexpubkey(pubkey) {
        this._pubkey = pubkey;
      }
      /**
       * Get the user's pubkey
       * @returns {string} The user's pubkey
       */
      get pubkey() {
        if (!this._pubkey) {
          if (!this._npub)
            throw new Error("npub not set");
          this._pubkey = nip19_exports.decode(this.npub).data;
        }
        return this._pubkey;
      }
      /**
       * Set the user's pubkey
       * @param pubkey {string} The user's pubkey
       */
      set pubkey(pubkey) {
        this._pubkey = pubkey;
      }
      /**
       * Instantiate an NDKUser from a NIP-05 string
       * @param nip05Id {string} The user's NIP-05
       * @param ndk {NDK} An NDK instance
       * @param skipCache {boolean} Whether to skip the cache or not
       * @returns {NDKUser | undefined} An NDKUser if one is found for the given NIP-05, undefined otherwise.
       */
      static async fromNip05(nip05Id, ndk, skipCache = false) {
        if (ndk?.cacheAdapter && ndk.cacheAdapter.loadNip05) {
          const profile2 = await ndk.cacheAdapter.loadNip05(nip05Id);
          if (profile2) {
            const user = new _NDKUser({
              pubkey: profile2.pubkey,
              relayUrls: profile2.relays,
              nip46Urls: profile2.nip46
            });
            user.ndk = ndk;
            return user;
          }
        }
        let opts = {};
        if (skipCache)
          opts.cache = "no-cache";
        const profile = await getNip05For(nip05Id, ndk?.httpFetch, opts);
        if (profile && ndk?.cacheAdapter && ndk.cacheAdapter.saveNip05) {
          ndk?.cacheAdapter.saveNip05(nip05Id, profile);
        }
        if (profile) {
          const user = new _NDKUser({
            pubkey: profile.pubkey,
            relayUrls: profile.relays,
            nip46Urls: profile.nip46
          });
          user.ndk = ndk;
          return user;
        }
      }
      /**
       * Fetch a user's profile
       * @param opts {NDKSubscriptionOptions} A set of NDKSubscriptionOptions
       * @returns User Profile
       */
      async fetchProfile(opts) {
        if (!this.ndk)
          throw new Error("NDK not set");
        if (!this.profile)
          this.profile = {};
        let setMetadataEvents = null;
        if (this.ndk.cacheAdapter && this.ndk.cacheAdapter.fetchProfile && opts?.cacheUsage !== "ONLY_RELAY" /* ONLY_RELAY */) {
          const profile = await this.ndk.cacheAdapter.fetchProfile(this.pubkey);
          if (profile) {
            this.profile = profile;
            return profile;
          }
        }
        if (!opts && // if no options have been set
        this.ndk.cacheAdapter && // and we have a cache
        this.ndk.cacheAdapter.locking) {
          setMetadataEvents = await this.ndk.fetchEvents(
            {
              kinds: [0],
              authors: [this.pubkey]
            },
            {
              cacheUsage: "ONLY_CACHE" /* ONLY_CACHE */,
              closeOnEose: true,
              groupable: false
            }
          );
          opts = {
            cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 250
          };
        }
        if (!setMetadataEvents || setMetadataEvents.size === 0) {
          setMetadataEvents = await this.ndk.fetchEvents(
            {
              kinds: [0],
              authors: [this.pubkey]
            },
            opts
          );
        }
        const sortedSetMetadataEvents = Array.from(setMetadataEvents).sort(
          (a, b) => a.created_at - b.created_at
        );
        if (sortedSetMetadataEvents.length === 0)
          return null;
        this.profile = profileFromEvent(sortedSetMetadataEvents[0]);
        if (this.profile && this.ndk.cacheAdapter && this.ndk.cacheAdapter.saveProfile) {
          this.ndk.cacheAdapter.saveProfile(this.pubkey, this.profile);
        }
        return this.profile;
      }
      /**
       * Returns a set of users that this user follows.
       */
      follows = follows.bind(this);
      /**
       * Pins a user or an event
       */
      pin = pin.bind(this);
      /**
       * Returns a set of relay list events for a user.
       * @returns {Promise<Set<NDKEvent>>} A set of NDKEvents returned for the given user.
       */
      async relayList() {
        if (!this.ndk)
          throw new Error("NDK not set");
        const pool = this.ndk.outboxPool || this.ndk.pool;
        const set = /* @__PURE__ */ new Set();
        for (const relay of pool.relays.values())
          set.add(relay);
        const relaySet = new NDKRelaySet(set, this.ndk);
        const event = await this.ndk.fetchEvent(
          {
            kinds: [10002],
            authors: [this.pubkey]
          },
          {
            closeOnEose: true,
            pool,
            groupable: true,
            subId: `relay-list-${this.pubkey.slice(0, 6)}`
          },
          relaySet
        );
        if (event)
          return NDKRelayList.from(event);
        return await this.relayListFromKind3();
      }
      async relayListFromKind3() {
        if (!this.ndk)
          throw new Error("NDK not set");
        const followList = await this.ndk.fetchEvent({
          kinds: [3],
          authors: [this.pubkey]
        });
        if (followList) {
          try {
            const content = JSON.parse(followList.content);
            const relayList = new NDKRelayList(this.ndk);
            const readRelays = /* @__PURE__ */ new Set();
            const writeRelays = /* @__PURE__ */ new Set();
            for (const [key, config] of Object.entries(content)) {
              if (!config) {
                readRelays.add(key);
                writeRelays.add(key);
              } else {
                const relayConfig = config;
                if (relayConfig.write)
                  writeRelays.add(key);
                if (relayConfig.read)
                  readRelays.add(key);
              }
            }
            relayList.readRelayUrls = Array.from(readRelays);
            relayList.writeRelayUrls = Array.from(writeRelays);
            return relayList;
          } catch (e) {
          }
        }
        return void 0;
      }
      /** @deprecated Use referenceTags instead. */
      /**
       * Get the tag that can be used to reference this user in an event
       * @returns {NDKTag} an NDKTag
       */
      tagReference() {
        return ["p", this.pubkey];
      }
      /**
       * Get the tags that can be used to reference this user in an event
       * @returns {NDKTag[]} an array of NDKTag
       */
      referenceTags(marker) {
        const tag = [["p", this.pubkey]];
        if (!marker)
          return tag;
        tag[0].push("", marker);
        return tag;
      }
      /**
       * Publishes the current profile.
       */
      async publish() {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        if (!this.profile)
          throw new Error("No profile available");
        this.ndk.assertSigner();
        const event = new NDKEvent(this.ndk, {
          kind: 0,
          content: serializeProfile(this.profile)
        });
        await event.publish();
      }
      /**
       * Add a follow to this user's contact list
       *
       * @param newFollow {NDKUser} The user to follow
       * @param currentFollowList {Set<NDKUser>} The current follow list
       * @param kind {NDKKind} The kind to use for this contact list (defaults to `3`)
       * @returns {Promise<boolean>} True if the follow was added, false if the follow already exists
       */
      async follow(newFollow, currentFollowList, kind = 3 /* Contacts */) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        this.ndk.assertSigner();
        if (!currentFollowList) {
          currentFollowList = await this.follows(void 0, void 0, kind);
        }
        if (currentFollowList.has(newFollow)) {
          return false;
        }
        currentFollowList.add(newFollow);
        const event = new NDKEvent(this.ndk, { kind });
        for (const follow of currentFollowList) {
          event.tag(follow);
        }
        await event.publish();
        return true;
      }
      /**
       * Validate a user's NIP-05 identifier (usually fetched from their kind:0 profile data)
       *
       * @param nip05Id The NIP-05 string to validate
       * @returns {Promise<boolean | null>} True if the NIP-05 is found and matches this user's pubkey,
       * False if the NIP-05 is found but doesn't match this user's pubkey,
       * null if the NIP-05 isn't found on the domain or we're unable to verify (because of network issues, etc.)
       */
      async validateNip05(nip05Id) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        const profilePointer = await getNip05For(nip05Id);
        if (profilePointer === null)
          return null;
        return profilePointer.pubkey === this.pubkey;
      }
      /**
       * Zap a user
       *
       * @param amount The amount to zap in millisatoshis
       * @param comment A comment to add to the zap request
       * @param extraTags Extra tags to add to the zap request
       * @param signer The signer to use (will default to the NDK instance's signer)
       */
      async zap(amount, comment, extraTags, signer) {
        if (!this.ndk)
          throw new Error("No NDK instance found");
        if (!signer) {
          this.ndk.assertSigner();
        }
        const zap = new Zap({
          ndk: this.ndk,
          zappedUser: this
        });
        const relays = Array.from(this.ndk.pool.relays.keys());
        const paymentRequest = await zap.createZapRequest(
          amount,
          comment,
          extraTags,
          relays,
          signer
        );
        return paymentRequest;
      }
    };
    var NDKPrivateKeySigner = class _NDKPrivateKeySigner {
      _user;
      privateKey;
      constructor(privateKey) {
        if (privateKey) {
          this.privateKey = privateKey;
          this._user = new NDKUser({
            hexpubkey: getPublicKey(this.privateKey)
          });
        }
      }
      static generate() {
        const privateKey = generatePrivateKey();
        return new _NDKPrivateKeySigner(privateKey);
      }
      async blockUntilReady() {
        if (!this._user) {
          throw new Error("NDKUser not initialized");
        }
        return this._user;
      }
      async user() {
        await this.blockUntilReady();
        return this._user;
      }
      async sign(event) {
        if (!this.privateKey) {
          throw Error("Attempted to sign without a private key");
        }
        return getSignature(event, this.privateKey);
      }
      async encrypt(recipient, value) {
        if (!this.privateKey) {
          throw Error("Attempted to encrypt without a private key");
        }
        const recipientHexPubKey = recipient.hexpubkey;
        return await nip04_exports.encrypt(this.privateKey, recipientHexPubKey, value);
      }
      async decrypt(sender, value) {
        if (!this.privateKey) {
          throw Error("Attempted to decrypt without a private key");
        }
        const senderHexPubKey = sender.hexpubkey;
        return await nip04_exports.decrypt(this.privateKey, senderHexPubKey, value);
      }
    };
    var NDKNostrRpc = class extends lib$1.EventEmitter {
      ndk;
      signer;
      debug;
      constructor(ndk, signer, debug4) {
        super();
        this.ndk = ndk;
        this.signer = signer;
        this.debug = debug4.extend("rpc");
      }
      /**
       * Subscribe to a filter. This function will resolve once the subscription is ready.
       */
      subscribe(filter) {
        const sub = this.ndk.subscribe(filter, {
          closeOnEose: false,
          groupable: false
        });
        sub.on("event", async (event) => {
          try {
            const parsedEvent = await this.parseEvent(event);
            if (parsedEvent.method) {
              this.emit("request", parsedEvent);
            } else {
              this.emit(`response-${parsedEvent.id}`, parsedEvent);
            }
          } catch (e) {
            this.debug("error parsing event", e, event.rawEvent());
          }
        });
        return new Promise((resolve, reject) => {
          sub.on("eose", () => resolve(sub));
        });
      }
      async parseEvent(event) {
        const remoteUser = this.ndk.getUser({ hexpubkey: event.pubkey });
        remoteUser.ndk = this.ndk;
        const decryptedContent = await this.signer.decrypt(remoteUser, event.content);
        const parsedContent = JSON.parse(decryptedContent);
        const { id, method, params, result, error } = parsedContent;
        if (method) {
          return { id, pubkey: event.pubkey, method, params, event };
        } else {
          return { id, result, error, event };
        }
      }
      async sendResponse(id, remotePubkey, result, kind = 24133 /* NostrConnect */, error) {
        const res = { id, result };
        if (error) {
          res.error = error;
        }
        const localUser = await this.signer.user();
        const remoteUser = this.ndk.getUser({ hexpubkey: remotePubkey });
        const event = new NDKEvent(this.ndk, {
          kind,
          content: JSON.stringify(res),
          tags: [["p", remotePubkey]],
          pubkey: localUser.hexpubkey
        });
        event.content = await this.signer.encrypt(remoteUser, event.content);
        await event.sign(this.signer);
        await event.publish();
      }
      /**
       * Sends a request.
       * @param remotePubkey
       * @param method
       * @param params
       * @param kind
       * @param id
       */
      async sendRequest(remotePubkey, method, params = [], kind = 24133, cb) {
        const id = Math.random().toString(36).substring(7);
        const localUser = await this.signer.user();
        const remoteUser = this.ndk.getUser({ hexpubkey: remotePubkey });
        const request = { id, method, params };
        const promise = new Promise((resolve) => {
          const responseHandler = (response) => {
            if (response.result === "auth_url") {
              this.once(`response-${id}`, responseHandler);
              this.emit("authUrl", response.error);
            } else if (cb) {
              cb(response);
            }
          };
          this.once(`response-${id}`, responseHandler);
        });
        const event = new NDKEvent(this.ndk, {
          kind,
          content: JSON.stringify(request),
          tags: [["p", remotePubkey]],
          pubkey: localUser.pubkey
        });
        event.content = await this.signer.encrypt(remoteUser, event.content);
        await event.sign(this.signer);
        this.debug(`sending ${method} request to`, remotePubkey);
        await event.publish();
        return promise;
      }
    };
    var NDKNip46Signer = class extends lib$1.EventEmitter {
      ndk;
      remoteUser;
      remotePubkey;
      token;
      localSigner;
      nip05;
      rpc;
      debug;
      relayUrls = [];
      /**
       * @param ndk - The NDK instance to use
       * @param tokenOrRemoteUser - The public key, or a connection token, of the npub that wants to be published as
       * @param localSigner - The signer that will be used to request events to be signed
       */
      constructor(ndk, tokenOrRemoteUser, localSigner) {
        super();
        let remotePubkey;
        let token;
        if (tokenOrRemoteUser.includes("#")) {
          const parts = tokenOrRemoteUser.split("#");
          remotePubkey = new NDKUser({ npub: parts[0] }).pubkey;
          token = parts[1];
        } else if (tokenOrRemoteUser.startsWith("npub")) {
          remotePubkey = new NDKUser({
            npub: tokenOrRemoteUser
          }).pubkey;
        } else if (tokenOrRemoteUser.match(/\./)) {
          this.nip05 = tokenOrRemoteUser;
        } else {
          remotePubkey = tokenOrRemoteUser;
        }
        this.ndk = ndk;
        if (remotePubkey)
          this.remotePubkey = remotePubkey;
        this.token = token;
        this.debug = ndk.debug.extend("nip46:signer");
        this.remoteUser = new NDKUser({ pubkey: remotePubkey });
        if (!localSigner) {
          this.localSigner = NDKPrivateKeySigner.generate();
        } else {
          this.localSigner = localSigner;
        }
        this.rpc = new NDKNostrRpc(ndk, this.localSigner, this.debug);
        this.rpc.on("authUrl", (...props) => {
          this.emit("authUrl", ...props);
        });
        this.localSigner.user().then((localUser) => {
          this.rpc.subscribe({
            kinds: [24133 /* NostrConnect */, 24134 /* NostrConnectAdmin */],
            "#p": [localUser.pubkey]
          });
        });
      }
      /**
       * Get the user that is being published as
       */
      async user() {
        return this.remoteUser;
      }
      async blockUntilReady() {
        const localUser = await this.localSigner.user();
        const remoteUser = this.ndk.getUser({ pubkey: this.remotePubkey });
        if (this.nip05 && !this.remotePubkey) {
          NDKUser.fromNip05(this.nip05).then((user) => {
            if (user) {
              this.remoteUser = user;
              this.remotePubkey = user.pubkey;
              this.relayUrls = user.nip46Urls;
            }
          });
        }
        if (!this.remotePubkey) {
          throw new Error("Remote pubkey not set");
        }
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const connectParams = [localUser.pubkey];
            if (this.token) {
              connectParams.push(this.token);
            }
            this.rpc.sendRequest(
              this.remotePubkey,
              "connect",
              connectParams,
              24133,
              (response) => {
                if (response.result === "ack") {
                  resolve(remoteUser);
                } else {
                  reject(response.error);
                }
              }
            );
          }, 100);
        });
      }
      async encrypt(recipient, value) {
        this.debug("asking for encryption");
        const promise = new Promise((resolve, reject) => {
          this.rpc.sendRequest(
            this.remotePubkey,
            "nip04_encrypt",
            [recipient.pubkey, value],
            24133,
            (response) => {
              if (!response.error) {
                resolve(response.result);
              } else {
                reject(response.error);
              }
            }
          );
        });
        return promise;
      }
      async decrypt(sender, value) {
        this.debug("asking for decryption");
        const promise = new Promise((resolve, reject) => {
          this.rpc.sendRequest(
            this.remotePubkey,
            "nip04_decrypt",
            [sender.pubkey, value],
            24133,
            (response) => {
              if (!response.error) {
                const value2 = JSON.parse(response.result);
                resolve(value2[0]);
              } else {
                reject(response.error);
              }
            }
          );
        });
        return promise;
      }
      async sign(event) {
        this.debug("asking for a signature");
        const promise = new Promise((resolve, reject) => {
          this.rpc.sendRequest(
            this.remotePubkey,
            "sign_event",
            [JSON.stringify(event)],
            24133,
            (response) => {
              this.debug("got a response", response);
              if (!response.error) {
                const json = JSON.parse(response.result);
                resolve(json.sig);
              } else {
                reject(response.error);
              }
            }
          );
        });
        return promise;
      }
      /**
       * Allows creating a new account on the remote server.
       * @param username Desired username for the NIP-05
       * @param domain Desired domain for the NIP-05
       * @param email Email address to associate with this account -- Remote servers may use this for recovery
       * @returns The public key of the newly created account
       */
      async createAccount(username, domain, email) {
        this.debug("asking to create an account");
        const req = [];
        if (username)
          req.push(username);
        if (domain)
          req.push(domain);
        if (email)
          req.push(email);
        return new Promise((resolve, reject) => {
          this.rpc.sendRequest(
            this.remotePubkey,
            "create_account",
            req,
            24134 /* NostrConnectAdmin */,
            (response) => {
              this.debug("got a response", response);
              if (!response.error) {
                const pubkey = response.result;
                resolve(pubkey);
              } else {
                reject(response.error);
              }
            }
          );
        });
      }
    };

    // src/events/dedup.ts
    function dedup(event1, event2) {
      if (event1.created_at > event2.created_at) {
        return event1;
      }
      return event2;
    }
    var OutboxItem = class {
      /**
       * Type of item
       */
      type;
      /**
       * The relay URLs that are of interest to this item
       */
      relayUrlScores;
      readRelays;
      writeRelays;
      constructor(type) {
        this.type = type;
        this.relayUrlScores = /* @__PURE__ */ new Map();
        this.readRelays = /* @__PURE__ */ new Set();
        this.writeRelays = /* @__PURE__ */ new Set();
      }
    };
    var OutboxTracker = class extends lib$1.EventEmitter {
      data;
      ndk;
      debug;
      constructor(ndk) {
        super();
        this.ndk = ndk;
        this.debug = ndk.debug.extend("outbox-tracker");
        this.data = new dist.LRUCache({
          maxSize: 1e5,
          entryExpirationTimeInMS: 5e3
        });
      }
      trackUsers(items) {
        for (const item of items) {
          const itemKey = getKeyFromItem(item);
          if (this.data.has(itemKey))
            continue;
          const outboxItem = this.track(item, "user");
          const user = item instanceof NDKUser ? item : new NDKUser({ hexpubkey: item });
          user.ndk = this.ndk;
          user.relayList().then((relayList) => {
            if (relayList) {
              outboxItem.readRelays = new Set(relayList.readRelayUrls);
              outboxItem.writeRelays = new Set(relayList.writeRelayUrls);
              for (const relayUrl of outboxItem.readRelays) {
                if (this.ndk.pool.blacklistRelayUrls.has(relayUrl)) {
                  this.debug(`removing blacklisted relay ${relayUrl} from read relays`);
                  outboxItem.readRelays.delete(relayUrl);
                }
              }
              for (const relayUrl of outboxItem.writeRelays) {
                if (this.ndk.pool.blacklistRelayUrls.has(relayUrl)) {
                  this.debug(`removing blacklisted relay ${relayUrl} from write relays`);
                  outboxItem.writeRelays.delete(relayUrl);
                }
              }
              this.data.set(itemKey, outboxItem);
              this.debug(
                `Adding ${outboxItem.readRelays.size} read relays and ${outboxItem.writeRelays.size} write relays for ${user.hexpubkey}`
              );
            }
          });
        }
      }
      /**
       *
       * @param key
       * @param score
       */
      track(item, type) {
        const key = getKeyFromItem(item);
        type ??= getTypeFromItem(item);
        let outboxItem = this.data.get(key);
        if (!outboxItem)
          outboxItem = new OutboxItem(type);
        this.data.set(key, outboxItem);
        return outboxItem;
      }
    };
    function getKeyFromItem(item) {
      if (item instanceof NDKUser) {
        return item.hexpubkey;
      } else {
        return item;
      }
    }
    function getTypeFromItem(item) {
      if (item instanceof NDKUser) {
        return "user";
      } else {
        return "kind";
      }
    }
    var NDKPool = class extends lib$1.EventEmitter {
      // TODO: This should probably be an LRU cache
      relays = /* @__PURE__ */ new Map();
      blacklistRelayUrls;
      debug;
      temporaryRelayTimers = /* @__PURE__ */ new Map();
      flappingRelays = /* @__PURE__ */ new Set();
      // A map to store timeouts for each flapping relay.
      backoffTimes = /* @__PURE__ */ new Map();
      constructor(relayUrls = [], blacklistedRelayUrls = [], ndk, debug4) {
        super();
        this.debug = debug4 ?? ndk.debug.extend("pool");
        for (const relayUrl of relayUrls) {
          const relay = new NDKRelay(relayUrl);
          this.addRelay(relay, false);
        }
        this.blacklistRelayUrls = new Set(blacklistedRelayUrls);
      }
      /**
       * Adds a relay to the pool, and sets a timer to remove it if it is not used within the specified time.
       * @param relay - The relay to add to the pool.
       * @param removeIfUnusedAfter - The time in milliseconds to wait before removing the relay from the pool after it is no longer used.
       */
      useTemporaryRelay(relay, removeIfUnusedAfter = 6e5) {
        const relayAlreadyInPool = this.relays.has(relay.url);
        if (!relayAlreadyInPool) {
          this.addRelay(relay);
        }
        const existingTimer = this.temporaryRelayTimers.get(relay.url);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        if (!relayAlreadyInPool || existingTimer) {
          const timer = setTimeout(() => {
            this.removeRelay(relay.url);
          }, removeIfUnusedAfter);
          this.temporaryRelayTimers.set(relay.url, timer);
        }
      }
      /**
       * Adds a relay to the pool.
       *
       * @param relay - The relay to add to the pool.
       * @param connect - Whether or not to connect to the relay.
       */
      addRelay(relay, connect = true) {
        const relayUrl = relay.url;
        if (this.blacklistRelayUrls?.has(relayUrl)) {
          this.debug(`Relay ${relayUrl} is blacklisted`);
          return;
        }
        relay.on("notice", async (relay2, notice) => this.emit("notice", relay2, notice));
        relay.on("connect", () => this.handleRelayConnect(relayUrl));
        relay.on("ready", () => this.handleRelayReady(relay));
        relay.on("disconnect", async () => this.emit("relay:disconnect", relay));
        relay.on("flapping", () => this.handleFlapping(relay));
        relay.on("auth", async (challenge) => this.emit("relay:auth", relay, challenge));
        this.relays.set(relayUrl, relay);
        if (connect) {
          relay.connect().catch((e) => {
            this.debug(`Failed to connect to relay ${relayUrl}`, e);
          });
        }
      }
      /**
       * Removes a relay from the pool.
       * @param relayUrl - The URL of the relay to remove.
       * @returns {boolean} True if the relay was removed, false if it was not found.
       */
      removeRelay(relayUrl) {
        const relay = this.relays.get(relayUrl);
        if (relay) {
          relay.disconnect();
          this.relays.delete(relayUrl);
          this.emit("relay:disconnect", relay);
          return true;
        }
        const existingTimer = this.temporaryRelayTimers.get(relayUrl);
        if (existingTimer) {
          clearTimeout(existingTimer);
          this.temporaryRelayTimers.delete(relayUrl);
        }
        return false;
      }
      /**
       * Fetches a relay from the pool, or creates a new one if it does not exist.
       *
       * New relays will be attempted to be connected.
       */
      getRelay(url, connect = true) {
        let relay = this.relays.get(url);
        if (!relay) {
          relay = new NDKRelay(url);
          this.addRelay(relay, connect);
        }
        return relay;
      }
      handleRelayConnect(relayUrl) {
        this.debug(`Relay ${relayUrl} connected`);
        this.emit("relay:connect", this.relays.get(relayUrl));
        if (this.stats().connected === this.relays.size) {
          this.emit("connect");
        }
      }
      handleRelayReady(relay) {
        this.debug(`Relay ${relay.url} ready`);
        this.emit("relay:ready", relay);
      }
      /**
       * Attempts to establish a connection to each relay in the pool.
       *
       * @async
       * @param {number} [timeoutMs] - Optional timeout in milliseconds for each connection attempt.
       * @returns {Promise<void>} A promise that resolves when all connection attempts have completed.
       * @throws {Error} If any of the connection attempts result in an error or timeout.
       */
      async connect(timeoutMs) {
        const promises = [];
        this.debug(
          `Connecting to ${this.relays.size} relays${timeoutMs ? `, timeout ${timeoutMs}...` : ""}`
        );
        for (const relay of this.relays.values()) {
          if (timeoutMs) {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(`Timed out after ${timeoutMs}ms`), timeoutMs);
            });
            promises.push(
              Promise.race([relay.connect(), timeoutPromise]).catch((e) => {
                this.debug(
                  `Failed to connect to relay ${relay.url}: ${e ?? "No reason specified"}`
                );
              })
            );
          } else {
            promises.push(relay.connect());
          }
        }
        if (timeoutMs) {
          setTimeout(() => {
            const allConnected = this.stats().connected === this.relays.size;
            const someConnected = this.stats().connected > 0;
            if (!allConnected && someConnected) {
              this.emit("connect");
            }
          }, timeoutMs);
        }
        await Promise.all(promises);
      }
      checkOnFlappingRelays() {
        const flappingRelaysCount = this.flappingRelays.size;
        const totalRelays = this.relays.size;
        if (flappingRelaysCount / totalRelays >= 0.8) {
          for (const relayUrl of this.flappingRelays) {
            this.backoffTimes.set(relayUrl, 0);
          }
        }
      }
      handleFlapping(relay) {
        this.debug(`Relay ${relay.url} is flapping`);
        let currentBackoff = this.backoffTimes.get(relay.url) || 5e3;
        currentBackoff = currentBackoff * 2;
        this.backoffTimes.set(relay.url, currentBackoff);
        this.debug(`Backoff time for ${relay.url} is ${currentBackoff}ms`);
        setTimeout(() => {
          this.debug(`Attempting to reconnect to ${relay.url}`);
          relay.connect();
          this.checkOnFlappingRelays();
        }, currentBackoff);
        relay.disconnect();
        this.emit("flapping", relay);
      }
      size() {
        return this.relays.size;
      }
      /**
       * Returns the status of each relay in the pool.
       * @returns {NDKPoolStats} An object containing the number of relays in each status.
       */
      stats() {
        const stats = {
          total: 0,
          connected: 0,
          disconnected: 0,
          connecting: 0
        };
        for (const relay of this.relays.values()) {
          stats.total++;
          if (relay.status === 1 /* CONNECTED */) {
            stats.connected++;
          } else if (relay.status === 3 /* DISCONNECTED */) {
            stats.disconnected++;
          } else if (relay.status === 0 /* CONNECTING */) {
            stats.connecting++;
          }
        }
        return stats;
      }
      connectedRelays() {
        return Array.from(this.relays.values()).filter(
          (relay) => relay.status === 1 /* CONNECTED */
        );
      }
      /**
       * Get a list of all relay urls in the pool.
       */
      urls() {
        return Array.from(this.relays.keys());
      }
    };

    // src/relay/sets/utils.ts
    function correctRelaySet(relaySet, pool) {
      const connectedRelays = pool.connectedRelays();
      const includesConnectedRelay = Array.from(relaySet.relays).some((relay) => {
        return connectedRelays.map((r) => r.url).includes(relay.url);
      });
      if (!includesConnectedRelay) {
        for (const relay of connectedRelays) {
          relaySet.addRelay(relay);
        }
      }
      if (connectedRelays.length === 0) {
        for (const relay of pool.relays.values()) {
          relaySet.addRelay(relay);
        }
      }
      return relaySet;
    }

    // src/media/index.ts
    var SPEC_PATH = "/.well-known/nostr/nip96.json";
    var Nip96 = class {
      ndk;
      spec;
      url;
      nip98Required = false;
      /**
       * @param domain domain of the NIP96 service
       */
      constructor(domain, ndk) {
        this.url = `https://${domain}${SPEC_PATH}`;
        this.ndk = ndk;
      }
      async prepareUpload(blob, httpVerb = "POST") {
        this.validateHttpFetch();
        if (!this.spec)
          await this.fetchSpec();
        if (!this.spec)
          throw new Error("Failed to fetch NIP96 spec");
        let headers = {};
        if (this.nip98Required) {
          const authorizationHeader = await this.generateNip98Header(
            this.spec.api_url,
            httpVerb,
            blob
          );
          headers = { Authorization: authorizationHeader };
        }
        return {
          url: this.spec.api_url,
          headers
        };
      }
      /**
       * Provides an XMLHttpRequest-based upload method for browsers.
       * @example
       * const xhr = new XMLHttpRequest();
       * xhr.upload.addEventListener("progress", function(e) {
       *    const percentComplete = e.loaded / e.total;
       *    console.log(percentComplete);
       * });
       * const nip96 = ndk.getNip96("nostrcheck.me");
       * const blob = new Blob(["Hello, world!"], { type: "text/plain" });
       * const response = await nip96.xhrUpload(xhr, blob);
       * console.log(response);
       * @returns Promise that resolves to the upload response
       */
      async xhrUpload(xhr, blob) {
        const httpVerb = "POST";
        const { url, headers } = await this.prepareUpload(blob, httpVerb);
        xhr.open(httpVerb, url, true);
        if (headers["Authorization"]) {
          xhr.setRequestHeader("Authorization", headers["Authorization"]);
        }
        const formData = new FormData();
        formData.append("file", blob);
        return new Promise((resolve, reject) => {
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(xhr.statusText));
            }
          };
          xhr.onerror = function() {
            reject(new Error("Network Error"));
          };
          xhr.send(formData);
        });
      }
      /**
       * Fetch-based upload method. Note that this will use NDK's httpFetch
       * @param blob
       * @returns Promise that resolves to the upload response
       *
       * @example
       * const nip96 = ndk.getNip96("nostrcheck.me");
       * const blob = new Blob(["Hello, world!"], { type: "text/plain" });
       * const response = await nip96.upload(blob);
       * console.log(response);
       */
      async upload(blob) {
        const httpVerb = "POST";
        const { url, headers } = await this.prepareUpload(blob, httpVerb);
        const formData = new FormData();
        formData.append("file", blob);
        const res = await this.ndk.httpFetch(this.spec.api_url, {
          method: httpVerb,
          headers,
          body: formData
        });
        if (res.status !== 200)
          throw new Error(`Failed to upload file to ${url}`);
        const json = await res.json();
        if (json.status !== "success")
          throw new Error(json.message);
        return json;
      }
      validateHttpFetch() {
        if (!this.ndk)
          throw new Error("NDK is required to fetch NIP96 spec");
        if (!this.ndk.httpFetch)
          throw new Error("NDK must have an httpFetch method to fetch NIP96 spec");
      }
      async fetchSpec() {
        this.validateHttpFetch();
        const res = await this.ndk.httpFetch(this.url);
        if (res.status !== 200)
          throw new Error(`Failed to fetch NIP96 spec from ${this.url}`);
        const spec = await res.json();
        if (!spec)
          throw new Error(`Failed to parse NIP96 spec from ${this.url}`);
        this.spec = spec;
        this.nip98Required = this.spec.plans.free.is_nip98_required;
      }
      async generateNip98Header(requestUrl, httpMethod, blob) {
        const event = new NDKEvent(this.ndk, {
          kind: 27235 /* HttpAuth */,
          tags: [
            ["u", requestUrl],
            ["method", httpMethod]
          ]
        });
        if (["POST", "PUT", "PATCH"].includes(httpMethod)) {
          const sha256Hash = await this.calculateSha256(blob);
          event.tags.push(["payload", sha256Hash]);
        }
        await event.sign();
        const encodedEvent = btoa(JSON.stringify(event.rawEvent()));
        return `Nostr ${encodedEvent}`;
      }
      async calculateSha256(blob) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        return hashHex;
      }
    };

    // src/ndk/index.ts
    var DEFAULT_OUTBOX_RELAYS = ["wss://purplepag.es", "wss://relay.snort.social"];
    var DEFAULT_BLACKLISTED_RELAYS = [
      "wss://brb.io"
      // BRB
    ];
    var NDK = class extends lib$1.EventEmitter {
      explicitRelayUrls;
      pool;
      outboxPool;
      _signer;
      _activeUser;
      cacheAdapter;
      debug;
      devWriteRelaySet;
      outboxTracker;
      mutedIds;
      clientName;
      clientNip89;
      /**
       * Default relay-auth policy that will be used when a relay requests authentication,
       * if no other policy is specified for that relay.
       *
       * @example Disconnect from relays that request authentication:
       * ```typescript
       * ndk.relayAuthDefaultPolicy = NDKAuthPolicies.disconnect(ndk.pool);
       * ```
       *
       * @example Sign in to relays that request authentication:
       * ```typescript
       * ndk.relayAuthDefaultPolicy = NDKAuthPolicies.signIn({ndk})
       * ```
       *
       * @example Sign in to relays that request authentication, asking the user for confirmation:
       * ```typescript
       * ndk.relayAuthDefaultPolicy = (relay: NDKRelay) => {
       *     const signIn = NDKAuthPolicies.signIn({ndk});
       *     if (confirm(`Relay ${relay.url} is requesting authentication, do you want to sign in?`)) {
       *        signIn(relay);
       *     }
       * }
       * ```
       */
      relayAuthDefaultPolicy;
      /**
       * Fetch function to use for HTTP requests.
       *
       * @example
       * ```typescript
       * import fetch from "node-fetch";
       *
       * ndk.httpFetch = fetch;
       * ```
       */
      httpFetch;
      autoConnectUserRelays = true;
      autoFetchUserMutelist = true;
      constructor(opts = {}) {
        super();
        this.debug = opts.debug || debug3("ndk");
        this.explicitRelayUrls = opts.explicitRelayUrls || [];
        this.pool = new NDKPool(opts.explicitRelayUrls || [], opts.blacklistRelayUrls, this);
        this.debug(`Starting with explicit relays: ${JSON.stringify(this.explicitRelayUrls)}`);
        this.pool.on("relay:auth", async (relay, challenge) => {
          if (this.relayAuthDefaultPolicy) {
            await this.relayAuthDefaultPolicy(relay, challenge);
          }
        });
        this.autoConnectUserRelays = opts.autoConnectUserRelays ?? true;
        this.autoFetchUserMutelist = opts.autoFetchUserMutelist ?? true;
        this.clientName = opts.clientName;
        this.clientNip89 = opts.clientNip89;
        this.relayAuthDefaultPolicy = opts.relayAuthDefaultPolicy;
        if (opts.enableOutboxModel) {
          this.outboxPool = new NDKPool(
            opts.outboxRelayUrls || DEFAULT_OUTBOX_RELAYS,
            opts.blacklistRelayUrls || DEFAULT_BLACKLISTED_RELAYS,
            this,
            this.debug.extend("outbox-pool")
          );
          this.outboxTracker = new OutboxTracker(this);
        }
        this.signer = opts.signer;
        this.cacheAdapter = opts.cacheAdapter;
        this.mutedIds = opts.mutedIds || /* @__PURE__ */ new Map();
        if (opts.devWriteRelayUrls) {
          this.devWriteRelaySet = NDKRelaySet.fromRelayUrls(opts.devWriteRelayUrls, this);
        }
        try {
          this.httpFetch = fetch;
        } catch {
        }
      }
      /**
       * Adds an explicit relay to the pool.
       * @param url
       * @param relayAuthPolicy Authentication policy to use if different from the default
       * @param connect Whether to connect to the relay automatically
       * @returns
       */
      addExplicitRelay(urlOrRelay, relayAuthPolicy, connect = true) {
        let relay;
        if (typeof urlOrRelay === "string") {
          relay = new NDKRelay(urlOrRelay, relayAuthPolicy);
        } else {
          relay = urlOrRelay;
        }
        this.pool.addRelay(relay, connect);
        this.explicitRelayUrls.push(relay.url);
        return relay;
      }
      toJSON() {
        return { relayCount: this.pool.relays.size }.toString();
      }
      get activeUser() {
        return this._activeUser;
      }
      /**
       * Sets the active user for this NDK instance, typically this will be
       * called when assigning a signer to the NDK instance.
       *
       * This function will automatically connect to the user's relays if
       * `autoConnectUserRelays` is set to true.
       *
       * It will also fetch the user's mutelist if `autoFetchUserMutelist` is set to true.
       */
      set activeUser(user) {
        const differentUser = this._activeUser?.pubkey !== user?.pubkey;
        this._activeUser = user;
        if (user && differentUser) {
          const connectToUserRelays = async (user2) => {
            const relayList = await user2.relayList();
            if (!relayList) {
              this.debug("No relay list found for user", { npub: user2.npub });
              return;
            }
            this.debug("Connecting to user relays", {
              npub: user2.npub,
              relays: relayList.relays
            });
            for (const url of relayList.relays) {
              let relay = this.pool.relays.get(url);
              if (!relay) {
                relay = new NDKRelay(url);
                this.pool.addRelay(relay);
              }
            }
          };
          const fetchUserMuteList = async (user2) => {
            const muteLists = await this.fetchEvents([
              { kinds: [1e4 /* MuteList */], authors: [user2.pubkey] },
              {
                kinds: [3e4 /* FollowSet */],
                authors: [user2.pubkey],
                "#d": ["mute"],
                limit: 1
              }
            ]);
            if (!muteLists) {
              this.debug("No mute list found for user", { npub: user2.npub });
              return;
            }
            for (const muteList of muteLists) {
              const list = lists_default.from(muteList);
              for (const item of list.items) {
                this.mutedIds.set(item[1], item[0]);
              }
            }
          };
          const userFunctions = [];
          if (this.autoConnectUserRelays)
            userFunctions.push(connectToUserRelays);
          if (this.autoFetchUserMutelist)
            userFunctions.push(fetchUserMuteList);
          const runUserFunctions = async (user2) => {
            for (const fn of userFunctions) {
              await fn(user2);
            }
          };
          const pool = this.outboxPool || this.pool;
          if (pool.connectedRelays.length > 0) {
            runUserFunctions(user);
          } else {
            this.debug("Waiting for connection to main relays");
            pool.once("relay:ready", (relay) => {
              this.debug("New relay ready", relay?.url);
              runUserFunctions(user);
            });
          }
        } else if (!user) {
          this.mutedIds = /* @__PURE__ */ new Map();
        }
      }
      get signer() {
        return this._signer;
      }
      set signer(newSigner) {
        this._signer = newSigner;
        this.emit("signer:ready", newSigner);
        newSigner?.user().then((user) => {
          user.ndk = this;
          this.activeUser = user;
        });
      }
      /**
       * Connect to relays with optional timeout.
       * If the timeout is reached, the connection will be continued to be established in the background.
       */
      async connect(timeoutMs) {
        if (this._signer && this.autoConnectUserRelays) {
          this.debug("Attempting to connect to user relays specified by signer");
          if (this._signer.relays) {
            const relays = await this._signer.relays();
            relays.forEach((relay) => this.pool.addRelay(relay));
          }
        }
        const connections = [this.pool.connect(timeoutMs)];
        if (this.outboxPool) {
          connections.push(this.outboxPool.connect(timeoutMs));
        }
        this.debug("Connecting to relays", { timeoutMs });
        return Promise.allSettled(connections).then(() => {
        });
      }
      /**
       * Get a NDKUser object
       *
       * @param opts
       * @returns
       */
      getUser(opts) {
        const user = new NDKUser(opts);
        user.ndk = this;
        return user;
      }
      /**
       * Get a NDKUser from a NIP05
       * @param nip05 NIP-05 ID
       * @param skipCache Skip cache
       * @returns
       */
      async getUserFromNip05(nip05, skipCache = false) {
        return NDKUser.fromNip05(nip05, this, skipCache);
      }
      /**
       * Create a new subscription. Subscriptions automatically start, you can make them automatically close when all relays send back an EOSE by setting `opts.closeOnEose` to `true`)
       *
       * @param filters
       * @param opts
       * @param relaySet explicit relay set to use
       * @param autoStart automatically start the subscription
       * @returns NDKSubscription
       */
      subscribe(filters, opts, relaySet, autoStart = true) {
        const subscription = new NDKSubscription(this, filters, opts, relaySet);
        if (relaySet) {
          for (const relay of relaySet.relays) {
            this.pool.useTemporaryRelay(relay);
          }
        }
        if (this.outboxPool && subscription.hasAuthorsFilter()) {
          const authors = subscription.filters.filter((filter) => filter.authors && filter.authors?.length > 0).map((filter) => filter.authors).flat();
          this.outboxTracker?.trackUsers(authors);
        }
        if (autoStart)
          subscription.start();
        return subscription;
      }
      /**
       * Publish an event to a relay
       * @param event event to publish
       * @param relaySet explicit relay set to use
       * @param timeoutMs timeout in milliseconds to wait for the event to be published
       * @returns The relays the event was published to
       *
       * @deprecated Use `event.publish()` instead
       */
      async publish(event, relaySet, timeoutMs) {
        this.debug("Deprecated: Use `event.publish()` instead");
        return event.publish(relaySet, timeoutMs);
      }
      /**
       * Fetch a single event.
       *
       * @param idOrFilter event id in bech32 format or filter
       * @param opts subscription options
       * @param relaySetOrRelay explicit relay set to use
       */
      async fetchEvent(idOrFilter, opts, relaySetOrRelay) {
        let filter;
        let relaySet;
        if (relaySetOrRelay instanceof NDKRelay) {
          relaySet = new NDKRelaySet(/* @__PURE__ */ new Set([relaySetOrRelay]), this);
        } else if (relaySetOrRelay instanceof NDKRelaySet) {
          relaySet = relaySetOrRelay;
        }
        if (!relaySetOrRelay && typeof idOrFilter === "string") {
          if (!isNip33AValue(idOrFilter)) {
            const relays = relaysFromBech32(idOrFilter);
            if (relays.length > 0) {
              relaySet = new NDKRelaySet(new Set(relays), this);
              relaySet = correctRelaySet(relaySet, this.pool);
            }
          }
        }
        if (typeof idOrFilter === "string") {
          filter = filterFromId(idOrFilter);
        } else {
          filter = idOrFilter;
        }
        if (!filter) {
          throw new Error(`Invalid filter: ${JSON.stringify(idOrFilter)}`);
        }
        return new Promise((resolve) => {
          const s = this.subscribe(
            filter,
            { ...opts || {}, closeOnEose: true },
            relaySet,
            false
          );
          s.on("event", (event) => {
            event.ndk = this;
            resolve(event);
          });
          s.on("eose", () => {
            resolve(null);
          });
          s.start();
        });
      }
      /**
       * Fetch events
       */
      async fetchEvents(filters, opts, relaySet) {
        return new Promise((resolve) => {
          const events = /* @__PURE__ */ new Map();
          const relaySetSubscription = this.subscribe(
            filters,
            { ...opts || {}, closeOnEose: true },
            relaySet,
            false
          );
          const onEvent = (event) => {
            const dedupKey = event.deduplicationKey();
            const existingEvent = events.get(dedupKey);
            if (existingEvent) {
              event = dedup(existingEvent, event);
            }
            event.ndk = this;
            events.set(dedupKey, event);
          };
          relaySetSubscription.on("event", onEvent);
          relaySetSubscription.on("event:dup", onEvent);
          relaySetSubscription.on("eose", () => {
            resolve(new Set(events.values()));
          });
          relaySetSubscription.start();
        });
      }
      /**
       * Ensures that a signer is available to sign an event.
       */
      assertSigner() {
        if (!this.signer) {
          this.emit("signerRequired");
          throw new Error("Signer required");
        }
      }
      /**
       * Creates a new Nip96 instance for the given domain.
       * @param domain Domain to use for nip96 uploads
       * @example Upload a file to a NIP-96 enabled domain:
       *
       * ```typescript
       * const blob = new Blob(["Hello, world!"], { type: "text/plain" });
       * const nip96 = ndk.getNip96("nostrcheck.me");
       * await nip96.upload(blob);
       * ```
       */
      getNip96(domain) {
        return new Nip96(domain, this);
      }
    };

    /* eslint-disable */
    // @ts-nocheck
    const TIMEOUT = 5000; // 5 sec
    const LOCALSTORE_KEY = '__nostrlogin_nip46';
    const ndk = new NDK({
        enableOutboxModel: false,
    });
    const profileNdk = new NDK({
        enableOutboxModel: true,
        explicitRelayUrls: ["wss://relay.nostr.band/all", "wss://purplepag.es"]
    });
    profileNdk.connect();
    let signer = null;
    let signerPromise = null;
    let launcherPromise = null;
    let popup = null;
    let userInfo = null;
    let callCount = 0;
    let callTimer = undefined;
    let optionsModal = {
        theme: 'default',
        startScreen: 'welcome',
        devOverrideBunkerOrigin: '',
    };
    let banner = null;
    const listNotifies = [];
    const nostr = {
        async getPublicKey() {
            await ensureSigner();
            if (userInfo)
                return userInfo.pubkey;
            else
                throw new Error('No user');
        },
        async signEvent(event) {
            await ensureSigner();
            return wait(async () => {
                event.pubkey = signer.remotePubkey;
                event.id = getEventHash(event);
                event.sig = await signer.sign(event);
                console.log("signed", { event });
                return event;
            });
        },
        async getRelays() {
            // FIXME implement!
            return {};
        },
        nip04: {
            async encrypt(pubkey, plaintext) {
                await ensureSigner();
                return wait(async () => await signer.encrypt(pubkey, plaintext));
            },
            async decrypt(pubkey, ciphertext) {
                await ensureSigner();
                return wait(async () => await signer.decrypt(pubkey, ciphertext));
            },
        },
    };
    const launch = async (opt) => {
        // mutex
        if (launcherPromise)
            await launcherPromise;
        const dialog = document.createElement('dialog');
        const modal = document.createElement('nl-auth');
        if (opt.theme) {
            modal.setAttribute('theme', opt.theme);
        }
        if (opt.startScreen) {
            modal.setAttribute('start-screen', opt.startScreen);
        }
        if (opt.bunkers) {
            modal.setAttribute('bunkers', opt.bunkers);
        }
        dialog.appendChild(modal);
        document.body.appendChild(dialog);
        launcherPromise = new Promise(ok => {
            const login = (name) => {
                modal.error = 'Please confirm in your key storage app.';
                // convert name to bunker url
                getBunkerUrl(name)
                    // connect to bunker by url
                    .then(bunkerUrl => authNip46('login', name, bunkerUrl))
                    .then(() => {
                    modal.isFetchLogin = false;
                    dialog.close();
                    ok();
                })
                    .catch(e => {
                    console.log('error', e);
                    modal.isFetchLogin = false;
                    modal.error = e.toString();
                });
            };
            const signup = (name) => {
                modal.error = 'Please confirm in your key storage app.';
                // create acc on service and get bunker url
                createAccount(name)
                    // connect to bunker by url
                    .then(({ bunkerUrl, sk }) => authNip46('signup', name, bunkerUrl, sk))
                    .then(() => {
                    modal.isFetchCreateAccount = false;
                    dialog.close();
                    ok();
                })
                    .catch(e => {
                    console.log('error', e);
                    modal.isFetchCreateAccount = false;
                    modal.error = e.toString();
                });
            };
            const checkNip05 = async (nip05) => {
                let available = false;
                let taken = false;
                let error = '';
                await (async () => {
                    if (!nip05 || !nip05.includes('@'))
                        return;
                    const [name, domain] = nip05.toLocaleLowerCase().split('@');
                    if (!name)
                        return;
                    const REGEXP = new RegExp(/^[\w-.]+@([\w-]+\.)+[\w-]{2,8}$/g);
                    if (!REGEXP.test(nip05)) {
                        error = 'Invalid name';
                        return;
                    }
                    if (!domain) {
                        error = 'Select service';
                        return;
                    }
                    const url = `https://${domain}/.well-known/nostr.json?name=${name.toLowerCase()}`;
                    try {
                        const r = await fetch(url);
                        const d = await r.json();
                        if (d.names[name]) {
                            taken = true;
                            return;
                        }
                    }
                    catch { }
                    available = true;
                })();
                return [available, taken, error];
            };
            modal.addEventListener('nlLogin', event => {
                login(event.detail);
            });
            modal.addEventListener('nlSignup', event => {
                signup(event.detail);
            });
            modal.addEventListener('nlCheckSignup', async (event) => {
                const [available, taken, error] = await checkNip05(event.detail);
                modal.error = error;
                if (!error && taken)
                    modal.error = 'Already taken';
                modal.signupNameIsAvailable = available;
            });
            modal.addEventListener('nlCheckLogin', async (event) => {
                const [available, taken, error] = await checkNip05(event.detail);
                modal.error = error;
                if (available)
                    modal.error = 'Name not found';
                modal.loginIsGood = taken;
            });
            modal.addEventListener('nlCloseModal', () => {
                modal.isFetchLogin = false;
                dialog.close();
                ok();
            });
            dialog.showModal();
        });
        return launcherPromise;
    };
    async function wait(cb) {
        if (!callTimer)
            callTimer = setTimeout(onCallTimeout, TIMEOUT);
        if (!callCount)
            await onCallStart();
        callCount++;
        let error;
        let result;
        try {
            result = await cb();
        }
        catch (e) {
            error = e;
        }
        callCount--;
        await onCallEnd();
        if (callTimer)
            clearTimeout(callTimer);
        callTimer = undefined;
        if (error)
            throw error;
        return result;
    }
    async function onCallStart() {
        // set spinner - we've started talking to the key storage
        if (banner)
            banner.isLoading = true;
    }
    async function onCallEnd() {
        // remove spinner - we've finished talking to the key storage,
        // also hide the 'Not responding' banner
        if (banner)
            banner.isLoading = false;
    }
    async function onCallTimeout() {
        // show 'Not responding' banner, hide when onCallEnd happens,
        // may be called multiple times - should check if banner is already visible
        // рано падает таймаут
        if (banner) {
            // banner.isLoading = false;
            banner.notify = {
                confirm: Date.now(),
                timeOut: { domain: userInfo?.nip05?.split('@')[1] },
            };
        }
    }
    async function getBunkerUrl(value) {
        if (!value)
            return '';
        if (value.startsWith('bunker://'))
            return value;
        if (value.includes('@')) {
            const [name, domain] = value.toLocaleLowerCase().split('@');
            const origin = optionsModal.devOverrideBunkerOrigin || `https://${domain}`;
            const bunkerUrl = `${origin}/.well-known/nostr.json?name=_`;
            const userUrl = `${origin}/.well-known/nostr.json?name=${name}`;
            const bunker = await fetch(bunkerUrl);
            const bunkerData = await bunker.json();
            const bunkerPubkey = bunkerData.names['_'];
            const bunkerRelays = bunkerData.nip46[bunkerPubkey];
            const user = await fetch(userUrl);
            const userData = await user.json();
            const userPubkey = userData.names[name];
            // console.log({
            //     bunkerData, userData, bunkerPubkey, bunkerRelays, userPubkey,
            //     name, domain, origin
            // })
            if (!bunkerRelays.length)
                throw new Error('Bunker relay not provided');
            return `bunker://${userPubkey}?relay=${bunkerRelays[0]}`;
        }
        throw new Error('Invalid user name or bunker url');
    }
    function bunkerUrlToInfo(bunkerUrl, sk = '') {
        const url = new URL(bunkerUrl);
        return {
            pubkey: url.hostname || url.pathname.split('//')[1],
            sk: sk || generatePrivateKey(),
            relays: url.searchParams.getAll('relay'),
        };
    }
    async function createAccount(nip05) {
        const [name, domain] = nip05.split('@');
        // we're gonna need it
        ensurePopup();
        // bunker's own url
        const bunkerUrl = await getBunkerUrl(`_@${domain}`);
        console.log("create account bunker's url", bunkerUrl);
        // parse bunker url and generate local nsec
        const info = bunkerUrlToInfo(bunkerUrl);
        // init signer to talk to the bunker (not the user!)
        await initSigner(info, { preparePopup: true, leavePopup: true });
        const params = [
            name,
            domain,
            '', // email
            optionsModal.perms || '',
        ];
        // due to a buggy sendRequest implementation it never resolves
        // the promise that it returns, so we have to provide a
        // callback and wait on it
        console.log('signer', signer);
        const r = await new Promise(ok => {
            signer.rpc.sendRequest(info.pubkey, 'create_account', params, undefined, ok);
        });
        console.log('create_account pubkey', r);
        if (r.result === 'error')
            throw new Error(r.error);
        return {
            bunkerUrl: `bunker://${r.result}?relay=${info.relays[0]}`,
            sk: info.sk, // reuse the same local key
        };
    }
    const connectModals = (defaultOpt) => {
        const initialModals = async (opt) => {
            await launch(opt);
        };
        const nlElements = document.getElementsByTagName('nl-button');
        for (let i = 0; i < nlElements.length; i++) {
            const theme = nlElements[i].getAttribute('nl-theme');
            const startScreen = nlElements[i].getAttribute('start-screen');
            const elementOpt = {
                ...defaultOpt,
            };
            if (theme)
                elementOpt.theme = theme;
            if (startScreen)
                elementOpt.startScreen = startScreen;
            nlElements[i].addEventListener('click', function () {
                initialModals(elementOpt);
            });
        }
    };
    const launchEnsurePopup = (url) => {
        ensurePopup();
        popup.location.href = url;
        popup.resizeTo(400, 700);
    };
    const launchAuthBanner = (opt) => {
        banner = document.createElement('nl-banner');
        banner.addEventListener('handleLoginBanner', event => {
            const startScreen = event.detail;
            launch({
                startScreen,
            });
        });
        banner.addEventListener('handleLogoutBanner', event => {
            logout();
        });
        banner.addEventListener('handleNotifyConfirmBanner', event => {
            launchEnsurePopup(event.detail);
        });
        banner.addEventListener('handleSetConfirmBanner', event => {
            listNotifies.push(event.detail);
            banner.listNotifies = listNotifies;
        });
        banner.addEventListener('handleOpenWelcomeModal', event => {
            launch(optionsModal);
        });
        banner.addEventListener('handleRetryConfirmBanner', () => {
            const url = listNotifies.pop();
            // FIXME go to nip05 domain? 
            if (!url)
                return;
            banner.listNotifies = listNotifies;
            launchEnsurePopup(url);
        });
        document.body.appendChild(banner);
    };
    async function ensureSigner() {
        // wait until competing requests are finished
        if (signerPromise)
            await signerPromise;
        if (launcherPromise)
            await launcherPromise;
        // still no signer? request auth from user
        if (!signer) {
            await launch({
                ...optionsModal,
            });
        }
        // give up
        if (!signer)
            throw new Error('Rejected by user');
    }
    async function initSigner(info, { connect = false, preparePopup = false, leavePopup = false } = {}) {
        // mutex
        if (signerPromise)
            await signerPromise;
        signerPromise = new Promise(async (ok, err) => {
            try {
                for (const r of info.relays)
                    ndk.addExplicitRelay(r, undefined);
                // wait until we connect, otherwise
                // signer won't start properly
                await ndk.connect();
                // console.log('creating signer', { info, connect });
                // create and prepare the signer
                signer = new NDKNip46Signer(ndk, info.pubkey, new NDKPrivateKeySigner(info.sk));
                // OAuth flow
                signer.on('authUrl', url => {
                    console.log('nostr login auth url', url);
                    if (callTimer)
                        clearTimeout(callTimer);
                    if (userInfo) {
                        // show the 'Please confirm' banner
                        if (banner) {
                            // banner.isLoading = false;
                            banner.notify = {
                                confirm: Date.now(),
                                url,
                            };
                        }
                    }
                    else {
                        // if it fails we will either return 'failed'
                        // to the window.nostr caller, or show proper error
                        // in our modal
                        launchEnsurePopup(url);
                    }
                });
                // pre-launch a popup if it won't be blocked,
                // only when we're expecting it
                if (connect || preparePopup)
                    if (navigator.userActivation.isActive)
                        ensurePopup();
                // if we're doing it for the first time then
                // we should send 'connect' NIP46 request
                if (connect) {
                    // since ndk doesn't yet support perms param
                    // we reimplement the 'connect' call here
                    // await signer.blockUntilReady();
                    const connectParams = [getPublicKey(info.sk), '', optionsModal.perms || ''];
                    await new Promise((ok, err) => {
                        signer.rpc.sendRequest(info.pubkey, 'connect', connectParams, 24133, (response) => {
                            if (response.result === 'ack') {
                                ok();
                            }
                            else {
                                err(response.error);
                            }
                        });
                    });
                }
                // console.log('created signer');
                // make sure it's closed
                if (!leavePopup)
                    closePopup();
                ok();
            }
            catch (e) {
                // make sure signer isn't set
                signer = null;
                err(e);
            }
        });
        return signerPromise;
    }
    async function init(opt) {
        // skip if it's already started or
        // if there is nip07 extension
        if (window.nostr)
            return;
        window.nostr = nostr;
        if ('darkMode' in opt) {
            localStorage.setItem('nl-dark-mode', `${opt.darkMode}`);
        }
        if (opt.iife) {
            launchAuthBanner();
        }
        else {
            connectModals(opt);
        }
        if (opt) {
            optionsModal = { ...opt };
        }
        try {
            // read conf from localstore
            const info = JSON.parse(window.localStorage.getItem(LOCALSTORE_KEY));
            if (info && info.pubkey && info.sk && info.relays && info.relays[0]) {
                await initSigner(info);
                onAuth('login', info);
            }
            else {
                console.log('nostr login bad stored info', info);
            }
        }
        catch (e) {
            console.log('nostr login init error', e);
            logout();
        }
    }
    function ensurePopup() {
        // user might have closed it already
        if (!popup || popup.closed) {
            // NOTE: do not set noreferrer, bunker might use referrer to
            // simplify the naming of the connected app.
            // NOTE: do not pass noopener, otherwise null is returned
            // and we can't pre-populate the Loading... message,
            // instead we set opener=null below
            popup = window.open('about:blank', '_blank', 'width=100,height=50');
            console.log('popup', popup);
            if (!popup)
                throw new Error('Popup blocked. Try again, please!');
            // emulate noopener without passing it
            popup.opener = null;
        }
        // initial state
        popup.document.write('Loading...');
    }
    function closePopup() {
        // make sure we release the popup
        try {
            popup?.close();
            popup = null;
        }
        catch { }
    }
    async function fetchProfile(info) {
        const user = new NDKUser({ pubkey: info.pubkey });
        user.ndk = profileNdk;
        return await user.fetchProfile();
    }
    function onAuth(type, info = null) {
        userInfo = info;
        if (banner) {
            banner.userInfo = userInfo;
            if (userInfo)
                banner.titleBanner = 'You are logged in';
            else
                banner.titleBanner = ''; // 'Use with Nostr';
        }
        if (info) {
            // async profile fetch
            fetchProfile(info).then(p => {
                if (userInfo !== info)
                    return;
                userInfo = {
                    ...userInfo,
                    picture: p?.image || p?.picture
                };
                banner.userInfo = userInfo;
            });
        }
        try {
            const npub = info ? nip19_exports.npubEncode(info.pubkey) : '';
            const options = {
                type,
            };
            if (type !== 'logout') {
                options.localNsec = nip19_exports.nsecEncode(info.sk);
                options.relays = info.relays;
            }
            if (optionsModal.onAuth)
                optionsModal.onAuth(npub, options);
            const event = new CustomEvent("nlAuth", { "detail": options });
            document.dispatchEvent(event);
        }
        catch (e) {
            console.log('onAuth error', e);
        }
    }
    async function authNip46(type, name, bunkerUrl, sk = '') {
        try {
            const info = bunkerUrlToInfo(bunkerUrl, sk);
            info.nip05 = name;
            // console.log('nostr login auth info', info);
            if (!info.pubkey || !info.sk || !info.relays[0]) {
                throw new Error(`Bad bunker url ${bunkerUrl}`);
            }
            const r = await initSigner(info, { connect: true });
            // only save after successfull login
            window.localStorage.setItem(LOCALSTORE_KEY, JSON.stringify(info));
            // callback
            onAuth(type, info);
            // result
            return r;
        }
        catch (e) {
            console.log('nostr login auth failed', e);
            // make ure it's closed
            closePopup();
            throw e;
        }
    }
    async function logout() {
        // clear localstore from user data
        onAuth('logout');
        signer = null;
        for (const r of ndk.pool.relays.keys())
            ndk.pool.removeRelay(r);
        window.localStorage.removeItem(LOCALSTORE_KEY);
    }

    // wrap to hide local vars
    (() => {
        // currentScript only visible in global scope code, not event handlers
        const cs = document.currentScript;
        document.addEventListener('DOMContentLoaded', async () => {
            const options = {
                iife: true
            };
            if (cs) {
                const dm = cs.getAttribute('data-dark-mode');
                if (dm)
                    options.darkMode = dm === 'true';
                const bunkers = cs.getAttribute('data-bunkers');
                if (bunkers)
                    options.bunkers = bunkers;
                const perms = cs.getAttribute('data-perms');
                if (perms)
                    options.perms = perms;
                const theme = cs.getAttribute('data-theme');
                if (theme)
                    options.theme = theme;
            }
            init(options);
        });
    })();

})();
