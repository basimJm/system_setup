package com.acme.shop.designsystem.components.chip

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.filter_remove_description
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/** One active filter shown as a removable chip (): the id is what the screen removes from its filter state. */
@Immutable
data class ActiveFilterChip(val id: String, val label: String)

/** Active filters under the search bar (): a wrapping row of chips, each with an × that removes that filter. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AppFilterChipRow(
    chips: List<ActiveFilterChip>,
    onRemove: (ActiveFilterChip) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (chips.isEmpty()) return
    val gap = AppTheme.spacing.space8
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(gap),
        verticalArrangement = Arrangement.spacedBy(gap),
    ) {
        chips.forEach { chip ->
            AppFilterChip(
                text = chip.label,
                selected = true,
                onClick = { onRemove(chip) },
                removeDescription = stringResource(Res.string.filter_remove_description, chip.label),
                onRemove = { onRemove(chip) },
            )
        }
    }
}
