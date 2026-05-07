import { defineComponent, h, nextTick, onBeforeUnmount, ref, watch, type PropType } from "vue";
import { burn } from "./core/effect";
import type { BurnController, BurnOptions } from "./core/types";

export const BurnIn = defineComponent({
  name: "BurnIn",
  props: {
    active: {
      type: Boolean,
      default: false
    },
    options: {
      type: Object as PropType<BurnOptions>,
      default: () => ({})
    },
    as: {
      type: String,
      default: "span"
    },
    replayKey: {
      type: [String, Number],
      default: 0
    },
    contentClass: {
      type: [String, Array, Object],
      default: null
    }
  },
  emits: ["start", "done", "cancel"],
  setup(props, { emit, expose, slots }) {
    const hostElement = ref<HTMLElement | null>(null);
    const targetElement = ref<HTMLElement | null>(null);
    let controller: BurnController | null = null;

    const cancel = () => {
      if (!controller) {
        return;
      }

      controller.cancel();
      controller = null;
      emit("cancel");
    };

    const play = async () => {
      await nextTick();

      if (!targetElement.value || !hostElement.value) {
        return null;
      }

      cancel();
      emit("start");
      const activeController = burn(targetElement.value, {
        ...props.options,
        host: hostElement.value
      });
      controller = activeController;
      activeController.done.then(() => {
        if (controller === activeController) {
          controller = null;
        }

        emit("done");
      });

      return controller;
    };

    watch(
      () => [props.active, props.replayKey],
      ([isActive]) => {
        if (isActive) {
          void play();
        } else {
          cancel();
        }
      },
      { immediate: true }
    );

    onBeforeUnmount(cancel);
    expose({ play, cancel });

    return () =>
      h(
        props.as,
        {
          ref: hostElement,
          class: "burn-in-root",
          style: {
            position: "relative",
            display: "inline-block"
          }
        },
        [
          h(
            "span",
            {
              ref: targetElement,
              class: ["burn-in-target", props.contentClass],
              style: {
                display: "inline-block"
              }
            },
            slots.default?.()
          )
        ]
      );
  }
});

export type { BurnController, BurnOptions };
