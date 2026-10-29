package com.acme.shop.core.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavOptions
import androidx.navigation.navOptions
import com.acme.shop.core.navigation.route.Graph
import com.acme.shop.core.navigation.route.Screen

class NavigatorDelegation(override val navController: NavHostController) : Navigator {
    override fun registerGraph(navGraphBuilder: NavGraphBuilder) {

    }

    override fun navigateAndClearBackstack(graph: Graph) {
        navController.navigate(graph) {
            popUpTo(navController.graph.id) {
                inclusive = true
            }
        }
    }

    override fun navigateTo(graph: Graph) {
        navController.navigate(graph)
    }

    override fun navigateTo(screen: Screen) {
        navController.navigate(screen, ScreenNavigation.options)
    }

    override fun navigateBack() {
        navController.popBackStack()
    }

    override fun navigateBack(
        destination: Screen,
        inclusive: Boolean
    ) {
        navController.popBackStack(destination, inclusive)
    }

    override fun navigateUp() {
        navController.navigateUp()
    }
}

/**
 * Options of every screen navigation. Single top: a double tap (e.g. "Book now", a cards) must not push the same
 * screen twice; Back then reopened a stale copy of the multi-step flow.
 */
object ScreenNavigation {
    val options: NavOptions = navOptions { launchSingleTop = true }
}
