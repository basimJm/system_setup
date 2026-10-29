package com.acme.shop.feature.sample.presentation.controller.contract

import com.acme.shop.feature.sample.domain.model.SampleItem

sealed interface SampleContract {

    data class UiState(
        val isLoading: Boolean = false,
        val items: List<SampleItem> = emptyList(),
        val errorMessage: String? = null,
    ) {
        val isEmpty: Boolean get() = !isLoading && items.isEmpty() && errorMessage == null
    }

    sealed interface UiAction {
        data object OnRefresh : UiAction
        data class OnItemClicked(val id: Int) : UiAction
    }

    sealed interface SideEffect {
        data class ShowMessage(val message: String) : SideEffect
    }
}
