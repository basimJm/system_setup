package com.acme.shop.designsystem.components.feedback

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.components.shimmer.AppShimmerList

/** The five states every data screen must handle. */
sealed interface AppContentState {
    data object Loading : AppContentState
    data object Offline : AppContentState
    data class Error(val message: String? = null) : AppContentState
    data object Empty : AppContentState
    data object Content : AppContentState
}

/**
 * Derives the screen state from the usual ViewModel flags, in the priority the PRD implies:
 * the first load shows shimmer, connectivity beats a generic error, an error beats emptiness.
 * `isLoading` only counts while nothing is shown yet (a refresh keeps the content visible).
 */
fun contentStateOf(
    isLoading: Boolean,
    isOffline: Boolean,
    errorMessage: String?,
    isEmpty: Boolean,
    hasContent: Boolean,
): AppContentState = when {
    isLoading && !hasContent -> AppContentState.Loading
    isOffline && !hasContent -> AppContentState.Offline
    errorMessage != null && !hasContent -> AppContentState.Error(errorMessage)
    isEmpty && !hasContent -> AppContentState.Empty
    else -> AppContentState.Content
}

/**
 * Renders one of the universal states or the content. Offline and error states always offer Retry;
 * the empty state takes the screen's contextual message and optional action.
 */
@Composable
fun AppStateContent(
    state: AppContentState,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    loading: @Composable () -> Unit = { AppShimmerList() },
    empty: @Composable () -> Unit = { AppEmptyState() },
    content: @Composable () -> Unit,
) {
    when (state) {
        AppContentState.Loading -> Box(modifier) { loading() }
        AppContentState.Offline -> Centered(modifier) { AppOfflineState(onRetry = onRetry) }
        is AppContentState.Error -> Centered(modifier) { AppErrorState(onRetry = onRetry, message = state.message) }
        AppContentState.Empty -> Centered(modifier) { empty() }
        AppContentState.Content -> Box(modifier) { content() }
    }
}

@Composable
private fun Centered(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}
