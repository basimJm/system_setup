package com.acme.shop.feature.sample.presentation.navigation

import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import androidx.navigation.navigation
import com.acme.shop.core.navigation.Navigator
import com.acme.shop.core.navigation.NavigatorDelegation
import com.acme.shop.core.navigation.route.Graph
import com.acme.shop.core.navigation.route.Screen
import com.acme.shop.core.notification.composable.rememberNotificationManager
import com.acme.shop.core.notification.model.NotificationStyle
import com.acme.shop.core.mvi.CollectSideEffect
import com.acme.shop.feature.sample.presentation.controller.contract.SampleContract
import com.acme.shop.feature.sample.presentation.controller.vm.SampleViewModel
import com.acme.shop.feature.sample.presentation.screen.SampleScreen
import org.koin.compose.viewmodel.koinViewModel

class SampleNavigation(override val navController: NavHostController) :
    Navigator by NavigatorDelegation(navController) {

    override fun registerGraph(navGraphBuilder: NavGraphBuilder) {
        navGraphBuilder.navigation<Graph.Home>(startDestination = Screen.Home) {

            composable<Screen.Home> {
                val viewModel: SampleViewModel = koinViewModel()
                val state by viewModel.state.collectAsStateWithLifecycle()
                val notificationManager = rememberNotificationManager()

                CollectSideEffect(viewModel.sideEffect) { effect ->
                    when (effect) {
                        is SampleContract.SideEffect.ShowMessage ->
                            notificationManager.show(effect.message, style = NotificationStyle.Error)
                    }
                }

                SampleScreen(state = state, onEvent = viewModel::onEvent)
            }
        }
    }
}
