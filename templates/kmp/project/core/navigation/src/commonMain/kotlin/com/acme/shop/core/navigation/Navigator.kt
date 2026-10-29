package com.acme.shop.core.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import com.acme.shop.core.navigation.route.Graph
import com.acme.shop.core.navigation.route.Screen

interface Navigator {
    fun registerGraph(
        navGraphBuilder: NavGraphBuilder,
    )

    val navController: NavHostController

    fun navigateTo(graph: Graph)
    fun navigateTo(screen: Screen)
    fun navigateAndClearBackstack(graph: Graph)
    fun navigateBack()
    fun navigateBack(destination: Screen, inclusive: Boolean = false)
    fun navigateUp()
}
