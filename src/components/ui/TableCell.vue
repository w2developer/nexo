<!-- TableCell.vue -->
<script setup>
    import { cn } from '../../utils/cn'

    const props = defineProps({
        class: { type: String, default: '' },
        align: { type: String, default: 'left' },
        vAlign: { type: String, default: 'middle' }
    })

    // Dicionário horizontal
    const alignMap = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    }

    // Dicionário vertical
    const vAlignMap = {
        top: 'align-top',
        middle: 'align-middle',
        bottom: 'align-bottom'
    }
</script>

<template>
    <td :class="cn('p-4', alignMap[props.align], vAlignMap[props.vAlign], props.class)">
        <slot />
    </td>
</template>