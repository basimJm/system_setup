package com.acme.shop.feature.sample.presentation.controller.vm

import com.acme.shop.core.analytics.AnalyticsAction
import com.acme.shop.core.analytics.AnalyticsTracker
import com.acme.shop.core.analytics.analyticsParams
import com.acme.shop.core.domain.AppResult
import com.acme.shop.designsystem.components.feedback.appErrorText
import com.acme.shop.core.mvi.BaseViewModel
import com.acme.shop.feature.sample.domain.usecase.GetSampleItemsUseCase
import com.acme.shop.feature.sample.presentation.analytics.SampleAnalytics
import com.acme.shop.feature.sample.presentation.controller.contract.SampleContract.SideEffect
import com.acme.shop.feature.sample.presentation.controller.contract.SampleContract.UiAction
import com.acme.shop.feature.sample.presentation.controller.contract.SampleContract.UiState
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class SampleViewModel(
    private val getSampleItemsUseCase: GetSampleItemsUseCase,
    private val analytics: AnalyticsTracker,
) : BaseViewModel<UiState, UiAction, SideEffect>(initialState = UiState()) {

    override fun onStart() {
        loadItems()
    }

    override fun handle(event: UiAction) {
        when (event) {
            UiAction.OnRefresh -> {
                analytics.trackAction(AnalyticsAction(SampleAnalytics.ACTION_REFRESH))
                loadItems()
            }

            is UiAction.OnItemClicked -> analytics.trackAction(
                AnalyticsAction(
                    SampleAnalytics.ACTION_ITEM_OPEN,
                    analyticsParams { number(SampleAnalytics.PARAM_ITEM_ID, event.id.toLong()) },
                ),
            )
        }
    }

    private fun loadItems() {
        scope.launch {
            getSampleItemsUseCase().collectLatest { result ->
                when (result) {
                    is AppResult.Loading ->
                        updateState { copy(isLoading = true, errorMessage = null) }

                    is AppResult.Success ->
                        updateState { copy(isLoading = false, items = result.data) }

                    is AppResult.Error -> {
                        val message = appErrorText(result.appError)
                        updateState { copy(isLoading = false, errorMessage = message) }
                        emitSideEffect(SideEffect.ShowMessage(message))
                    }
                }
            }
        }
    }
}
