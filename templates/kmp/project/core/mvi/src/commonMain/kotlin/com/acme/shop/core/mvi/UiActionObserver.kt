package com.acme.shop.core.mvi

import kotlin.concurrent.Volatile

/**
 * Process-wide tap on every UI action that reaches a [BaseViewModel].
 * The app shell installs an observer that maps actions to analytics events; nothing else should observe here.
 */
object UiActionObserver {
    @Volatile
    private var observer: ((owner: String, action: Any?) -> Unit)? = null

    fun install(observer: ((owner: String, action: Any?) -> Unit)?) {
        this.observer = observer
    }

    fun notify(owner: String, action: Any?) {
        observer?.invoke(owner, action)
    }
}
