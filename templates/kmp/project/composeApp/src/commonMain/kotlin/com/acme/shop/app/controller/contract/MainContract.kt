package com.acme.shop.app.controller.contract

sealed interface MainContract {
    /** Shell state: the app version shown by system screens. Appearance and session flows live on the view model. */
    data class UiState(
        val appVersion: String? = null,
    )

    sealed interface UiAction {
        data object OnSessionTimeOut : UiAction
    }

    sealed interface SideEffect
}
