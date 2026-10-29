package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Component dimensions from the design (button 54, field 52, border 1.5) and accessibility minimums (48 dp targets). */
@Immutable
data class SizeTokens(
    val touchTarget: Dp = 48.dp,
    val buttonHeight: Dp = 54.dp,
    val buttonHeightCompact: Dp = 40.dp,
    val fieldHeight: Dp = 52.dp,
    val chipHeight: Dp = 36.dp,
    val timeSlotWidth: Dp = 88.dp,
    val borderWidth: Dp = 1.5.dp,
    val hairline: Dp = 1.dp,
    val iconSmall: Dp = 16.dp,
    val icon: Dp = 20.dp,
    val iconLarge: Dp = 24.dp,
    val tabIcon: Dp = 22.dp,
    val topBarHeight: Dp = 50.dp,
    val bottomBarHeight: Dp = 64.dp,
    val railWidth: Dp = 88.dp,
    val avatarSmall: Dp = 32.dp,
    val avatar: Dp = 56.dp,
    val avatarLarge: Dp = 96.dp,
    val statusDot: Dp = 10.dp,
    val pageIndicatorActive: Dp = 24.dp,
    val choiceCardHeight: Dp = 96.dp,
    val onboardingIllustration: Dp = 200.dp,
    val badgeHeight: Dp = 24.dp,
    val countBadge: Dp = 18.dp,
    val otpBoxWidth: Dp = 46.dp,
    val otpBoxHeight: Dp = 56.dp,
    val stepDot: Dp = 28.dp,
    val stepLine: Dp = 2.dp,
    val sliderThumb: Dp = 22.dp,
    val illustration: Dp = 120.dp,
    val dialogMaxWidth: Dp = 360.dp,
    val sheetMaxWidth: Dp = 560.dp,
    val dragHandleWidth: Dp = 40.dp,
    val dragHandleHeight: Dp = 4.dp,
    val ratingStar: Dp = 18.dp,
    val ratingStarLarge: Dp = 36.dp,
    val logo: Dp = 88.dp,
    val splashLogo: Dp = 176.dp,
    val spinner: Dp = 24.dp,
    val spinnerStroke: Dp = 2.dp,
    val dialogIcon: Dp = 56.dp,
    val stateIcon: Dp = 64.dp,
    val shimmerLine: Dp = 14.dp,
    val cardImageHeight: Dp = 140.dp,
    val cardCompactWidth: Dp = 220.dp,
    val listItemImage: Dp = 64.dp,
)

val DefaultSizes = SizeTokens()
