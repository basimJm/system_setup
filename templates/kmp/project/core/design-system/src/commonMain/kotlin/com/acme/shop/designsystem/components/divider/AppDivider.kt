package com.acme.shop.designsystem.components.divider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.theme.AppTheme

@Composable
fun AppDivider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(AppTheme.sizes.hairline).background(AppTheme.colors.line))
}
