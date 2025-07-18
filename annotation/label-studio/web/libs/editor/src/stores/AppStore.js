/* global LSF_VERSION */

import { destroy, detach, flow, getEnv, getParent, getSnapshot, isRoot, types, walk } from "mobx-state-tree";

import uniqBy from "lodash/uniqBy";
import InfoModal from "../components/Infomodal/Infomodal";
import { Hotkey } from "../core/Hotkey";
import { destroy as destroySharedStore } from "../mixins/SharedChoiceStore/mixin";
import ToolsManager from "../tools/Manager";
import Utils from "../utils";
import { guidGenerator } from "../utils/unique";
import { clamp, delay, isDefined } from "../utils/utilities";
import { CREATE_RELATION_MODE } from "./Annotation/LinkingModes";
import AnnotationStore from "./Annotation/store";
import Project from "./ProjectStore";
import Settings from "./SettingsStore";
import Task from "./TaskStore";
import { UserExtended } from "./UserStore";
import { UserLabels } from "./UserLabels";
import {
  FF_CUSTOM_SCRIPT,
  FF_DEV_1536,
  FF_LSDV_4620_3_ML,
  FF_LSDV_4998,
  FF_REVIEWER_FLOW,
  FF_SIMPLE_INIT,
  isFF,
} from "../utils/feature-flags";
import { CommentStore } from "./Comment/CommentStore";
import { CustomButton } from "./CustomButton";

const hotkeys = Hotkey("AppStore", "Global Hotkeys");

export default types
  .model("AppStore", {
    /**
     * XML config
     */
    config: types.string,

    /**
     * Task with data, id and project
     */
    task: types.maybeNull(Task),

    project: types.maybeNull(Project),

    /**
     * History of task {taskId, annotationId}:
     */
    taskHistory: types.array(
      types.model({
        taskId: types.number,
        annotationId: types.maybeNull(types.string),
      }),
      [],
    ),

    /**
     * Configure the visual UI shown to the user
     */
    interfaces: types.array(types.string),

    /**
     * Flag for labeling of tasks
     */
    explore: types.optional(types.boolean, false),

    /**
     * Annotations Store
     */
    annotationStore: types.optional(AnnotationStore, {
      annotations: [],
      predictions: [],
      history: [],
    }),

    /**
     * Comments Store
     */
    commentStore: types.optional(CommentStore, {
      comments: [],
    }),

    /**
     * User of Label Studio
     */
    user: types.optional(types.maybeNull(types.safeReference(UserExtended)), null),

    /**
     * Debug for development environment
     */
    debug: window.HTX_DEBUG === true,

    /**
     * Settings of Label Studio
     */
    settings: types.optional(Settings, {}),

    /**
     * Data of description flag
     */
    description: types.maybeNull(types.string),
    // apiCalls: types.optional(types.boolean, true),

    /**
     * Flag for settings
     */
    showingSettings: types.optional(types.boolean, false),
    /**
     * Flag
     * Description of task in Label Studio
     */
    showingDescription: types.optional(types.boolean, false),
    /**
     * Loading of Label Studio
     */
    isLoading: types.optional(types.boolean, false),
    /**
     * Submitting task; used to prevent from duplicating requests
     */
    isSubmitting: false,
    /**
     * Flag for disable task in Label Studio
     */
    noTask: types.optional(types.boolean, false),
    /**
     * Flag for no access to specific task
     */
    noAccess: types.optional(types.boolean, false),
    /**
     * Finish of labeling
     */
    labeledSuccess: types.optional(types.boolean, false),

    /**
     * Show or hide comments section
     */
    showComments: false,

    /**
     * Dynamic preannotations
     */
    _autoAnnotation: false,

    /**
     * Auto accept suggested annotations
     */
    _autoAcceptSuggestions: false,

    /**
     * Indicator for suggestions awaiting
     */
    awaitingSuggestions: false,

    users: types.optional(types.array(UserExtended), []),

    userLabels: isFF(FF_DEV_1536) ? types.optional(UserLabels, { controls: {} }) : types.undefined,

    queueTotal: types.optional(types.number, 0),

    queuePosition: types.optional(types.number, 0),

    /**
     * Project field used for applying classifications to comments
     */
    commentClassificationConfig: types.maybeNull(types.string),

    customButtons: types.map(
      types.union(types.string, CustomButton, types.array(types.union(types.string, CustomButton))),
    ),
  })
  .preProcessSnapshot((sn) => {
    // This should only be handled if the sn.user value is an object, and converted to a reference id for other
    // entities.
    if (typeof sn.user !== "number") {
      const currentUser = sn.user ?? window.APP_SETTINGS?.user ?? null;

      // This should never be null, but just incase the app user is missing from constructor or the window
      if (currentUser) {
        sn.user = currentUser.id;

        sn.users = sn.users?.length
          ? [currentUser, ...sn.users.filter(({ id }) => id !== currentUser.id)]
          : [currentUser];
      }
    }
    // fix for old version of custom buttons which were just an array
    // @todo remove after a short time
    if (Array.isArray(sn.customButtons)) {
      sn.customButtons = { _replace: sn.customButtons };
    }
    return {
      ...sn,
      _autoAnnotation: localStorage.getItem("autoAnnotation") === "true",
      _autoAcceptSuggestions: localStorage.getItem("autoAcceptSuggestions") === "true",
    };
  })
  .volatile(() => ({
    version: typeof LSF_VERSION === "string" ? LSF_VERSION : "0.0.0",
    initialized: false,
    hydrated: false,
    suggestionsRequest: null,
    // @todo should be removed along with the FF; it's used to detect FF in other parts
    simpleInit: isFF(FF_SIMPLE_INIT),
  }))
  .views((self) => ({
    get events() {
      return getEnv(self).events;
    },
    get hasSegmentation() {
      // not an object and not a classification
      const isSegmentation = (t) => !t.getAvailableStates && !t.perRegionVisible;

      return Array.from(self.annotationStore.names.values()).some(isSegmentation);
    },
    get canGoNextTask() {
      const hasHistory = self.task && self.taskHistory && self.taskHistory.length > 1;

      if (hasHistory) {
        const lastTaskId = self.taskHistory[self.taskHistory.length - 1].taskId;

        return self.task.id !== lastTaskId;
      }
      return false;
    },
    get canGoPrevTask() {
      const hasHistory = self.task && self.taskHistory && self.taskHistory.length > 1;

      if (hasHistory) {
        const firstTaskId = self.taskHistory[0].taskId;

        return self.task.id !== firstTaskId;
      }
      return false;
    },
    get forceAutoAnnotation() {
      return getEnv(self).forceAutoAnnotation;
    },
    get forceAutoAcceptSuggestions() {
      return getEnv(self).forceAutoAcceptSuggestions;
    },
    get autoAnnotation() {
      return self.forceAutoAnnotation || self._autoAnnotation;
    },
    get autoAcceptSuggestions() {
      return self.forceAutoAcceptSuggestions || self._autoAcceptSuggestions;
    },
  }))
  .actions((self) => {
    let appControls;

    function setAppControls(controls) {
      appControls = controls;
    }

    function clearApp() {
      appControls?.clear();
    }

    function renderApp() {
      appControls?.render();
    }
    /**
     * Update settings display state
     */
    function toggleSettings() {
      self.showingSettings = !self.showingSettings;
    }

    /**
     * Update description display state
     */
    function toggleDescription() {
      self.showingDescription = !self.showingDescription;
    }

    function setFlags(flags) {
      const names = [
        "showingSettings",
        "showingDescription",
        "isLoading",
        "isSubmitting",
        "noTask",
        "noAccess",
        "labeledSuccess",
        "awaitingSuggestions",
      ];

      for (const n of names) if (n in flags) self[n] = flags[n];
    }

    /**
     * Check for interfaces
     * @param {string} name
     * @returns {string | undefined}
     */
    function hasInterface(...names) {
      return self.interfaces.find((i) => names.includes(i)) !== undefined;
    }

    function addInterface(name) {
      return self.interfaces.push(name);
    }

    function toggleInterface(name, value) {
      const index = self.interfaces.indexOf(name);
      const newValue = value ?? index < 0;

      if (newValue) {
        if (index < 0) self.interfaces.push(name);
      } else {
        if (index < 0) return;
        self.interfaces.splice(index, 1);
      }
    }

    function toggleComments(state) {
      return (self.showComments = state);
    }

    /**
     * Function
     */
    function afterCreate() {
      ToolsManager.setRoot(self);

      // important thing to detect Area atomatically: it hasn't access to store, only via global
      window.Htx = self;

      self.attachHotkeys();

      getEnv(self).events.invoke("labelStudioLoad", self);
    }

    function attachHotkeys() {
      // Unbind previous keys in case LS was re-initialized
      hotkeys.unbindAll();

      /**
       * Hotkey for submit
       */
      if (self.hasInterface("submit", "update", "review")) {
        hotkeys.addNamed("annotation:submit", () => {
          const annotationStore = self.annotationStore;
          const shouldDenyEmptyAnnotation = self.hasInterface("annotations:deny-empty");
          const entity = annotationStore.selected;
          const areResultsEmpty = entity.results.length === 0;
          const isReview = self.hasInterface("review") || entity.canBeReviewed;
          const isUpdate = !isReview && isDefined(entity.pk);
          // no changes were made over previously submitted version — no drafts, no pending changes
          const noChanges = !entity.history.canUndo && !entity.draftId;
          const isUpdateDisabled = isFF(FF_REVIEWER_FLOW) && isUpdate && noChanges;

          if (shouldDenyEmptyAnnotation && areResultsEmpty) return;
          if (annotationStore.viewingAll) return;
          if (isUpdateDisabled) return;
          if (entity.isReadOnly()) return;

          entity?.submissionInProgress();

          if (isReview) {
            self.acceptAnnotation();
          } else if (!isUpdate && self.hasInterface("submit")) {
            self.submitAnnotation();
          } else if (self.hasInterface("update")) {
            self.updateAnnotation();
          }
        });
      }

      /**
       * Hotkey for skip task
       */
      if (self.hasInterface("skip", "review")) {
        hotkeys.addNamed("annotation:skip", () => {
          if (self.annotationStore.viewingAll) return;

          const entity = self.annotationStore.selected;

          entity?.submissionInProgress();

          if (self.hasInterface("review")) {
            self.rejectAnnotation();
          } else {
            self.skipTask();
          }
        });
      }

      /**
       * Hotkey for delete
       */
      hotkeys.addNamed("region:delete-all", () => {
        const { selected } = self.annotationStore;

        if (window.confirm(getEnv(self).messages.CONFIRM_TO_DELETE_ALL_REGIONS)) {
          selected.deleteAllRegions();
        }
      });

      // create relation
      hotkeys.addNamed("region:relation", () => {
        const c = self.annotationStore.selected;

        if (c && c.highlightedNode && !c.isLinkingMode) {
          c.startLinkingMode(CREATE_RELATION_MODE, c.highlightedNode);
        }
      });

      // Focus fist focusable perregion when region is selected
      hotkeys.addNamed("region:focus", (e) => {
        e.preventDefault();
        const c = self.annotationStore.selected;

        if (c && c.highlightedNode && !c.isLinkingMode) {
          c.highlightedNode.requestPerRegionFocus();
        }
      });

      // unselect region
      hotkeys.addNamed("region:unselect", () => {
        const c = self.annotationStore.selected;

        if (c && !c.isLinkingMode && !c.isDrawing) {
          self.annotationStore.history.forEach((obj) => {
            obj.unselectAll();
          });

          c.unselectAll();
        }
      });

      hotkeys.addNamed("region:visibility", () => {
        const c = self.annotationStore.selected;

        if (c && !c.isLinkingMode) {
          c.hideSelectedRegions();
        }
      });

      hotkeys.addNamed("region:lock", () => {
        const c = self.annotationStore.selected;

        if (c && !c.isLinkingMode) {
          c.lockSelectedRegions();
        }
      });

      hotkeys.addNamed("region:visibility-all", () => {
        const { selected } = self.annotationStore;
        selected.regionStore.toggleVisibility();
      });

      hotkeys.addNamed("annotation:undo", () => {
        const annotation = self.annotationStore.selected;

        if (!annotation.isDrawing) annotation.undo();
      });

      hotkeys.addNamed("annotation:redo", () => {
        const annotation = self.annotationStore.selected;

        if (!annotation.isDrawing) annotation.redo();
      });

      hotkeys.addNamed("region:exit", () => {
        const c = self.annotationStore.selected;

        if (c && c.isLinkingMode) {
          c.stopLinkingMode();
        } else if (!c.isDrawing) {
          c.unselectAll();
        }
      });

      hotkeys.addNamed("region:delete", () => {
        const c = self.annotationStore.selected;

        if (c) {
          c.deleteSelectedRegions();
        }
      });

      hotkeys.addNamed("region:cycle", () => {
        const c = self.annotationStore.selected;

        c && c.regionStore.selectNext();
      });

      // duplicate selected regions
      hotkeys.addNamed("region:duplicate", (e) => {
        const { selected } = self.annotationStore;
        const { serializedSelection } = selected || {};

        if (!serializedSelection?.length) return;
        e.preventDefault();
        const results = selected.appendResults(serializedSelection);

        selected.selectAreas(results);
      });
    }

    function setTaskHistory(taskHistory) {
      self.taskHistory = taskHistory;
    }

    /**
     *
     * @param {*} taskObject
     * @param {*[]} taskHistory
     */
    function assignTask(taskObject) {
      if (taskObject && !Utils.Checkers.isString(taskObject.data)) {
        taskObject = {
          ...taskObject,
          data: JSON.stringify(taskObject.data),
        };
      }
      self.task = Task.create(taskObject);

      if (!self.taskHistory.some((x) => x.taskId === self.task.id)) {
        self.taskHistory.push({
          taskId: self.task.id,
          annotationId: null,
        });
      }
    }

    function assignConfig(config) {
      const cs = self.annotationStore;

      self.config = config;
      cs.initRoot(self.config);
    }

    /* eslint-disable no-unused-vars */
    function showModal(message, type = "warning") {
      InfoModal[type](message);

      // InfoModal.warning("You need to label at least something!");
    }
    /* eslint-enable no-unused-vars */

    function submitDraft(c, params = {}) {
      return new Promise((resolve) => {
        const events = getEnv(self).events;

        if (!events.hasEvent("submitDraft")) return resolve();
        const res = events.invokeFirst("submitDraft", self, c, params);

        if (res && res.then) res.then(resolve);
        else resolve(res);
      });
    }

    function waitForDraftSubmission() {
      return new Promise((resolve) => {
        if (!self.annotationStore.selected.isDraftSaving) resolve();

        const checkInterval = setInterval(() => {
          if (!self.annotationStore.selected.isDraftSaving) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    // Set `isSubmitting` flag to block [Submit] and related buttons during request
    // to prevent from sending duplicating requests.
    // Better to return request's Promise from SDK to make this work perfect.
    function handleSubmittingFlag(fn, defaultMessage = "Error during submit") {
      if (self.isSubmitting) return;
      self.setFlags({ isSubmitting: true });
      const res = fn();

      self.commentStore.setAddedCommentThisSession(false);

      // Wait for request, max 5s to not make disabled forever broken button;
      // but block for at least 0.2s to prevent from double clicking.
      Promise.race([Promise.all([res, delay(200)]), delay(5000)])
        .catch((err) => {
          showModal(err?.message || err || defaultMessage);
          console.error(err);
        })
        .then(() => self.setFlags({ isSubmitting: false }));
    }

    function incrementQueuePosition(number = 1) {
      self.queuePosition = clamp(self.queuePosition + number, 1, self.queueTotal);
    }

    function submitAnnotation() {
      if (self.isSubmitting) return;

      const entity = self.annotationStore.selected;
      const event = entity.exists ? "updateAnnotation" : "submitAnnotation";

      entity.beforeSend();

      if (!entity.validate()) return;

      if (!isFF(FF_CUSTOM_SCRIPT)) {
        entity.sendUserGenerate();
      }
      handleSubmittingFlag(async () => {
        if (isFF(FF_CUSTOM_SCRIPT)) {
          await self.waitForDraftSubmission();
          const allowedToSave = await getEnv(self).events.invoke("beforeSaveAnnotation", self, entity, { event });
          if (allowedToSave && allowedToSave.some((x) => x === false)) return;

          entity.sendUserGenerate();
        }
        await getEnv(self).events.invoke(event, self, entity);
        self.incrementQueuePosition();
        if (isFF(FF_CUSTOM_SCRIPT)) {
          entity.dropDraft();
        }
      });
      if (!isFF(FF_CUSTOM_SCRIPT)) {
        entity.dropDraft();
      }
    }

    function updateAnnotation(extraData) {
      if (self.isSubmitting) return;

      const entity = self.annotationStore.selected;

      entity.beforeSend();

      if (!entity.validate()) return;

      handleSubmittingFlag(async () => {
        if (isFF(FF_CUSTOM_SCRIPT)) {
          const allowedToSave = await getEnv(self).events.invoke("beforeSaveAnnotation", self, entity, {
            event: "updateAnnotation",
          });
          if (allowedToSave && allowedToSave.some((x) => x === false)) return;
        }
        await getEnv(self).events.invoke("updateAnnotation", self, entity, extraData);
        self.incrementQueuePosition();
        if (isFF(FF_CUSTOM_SCRIPT)) {
          entity.dropDraft();
          !entity.sentUserGenerate && entity.sendUserGenerate();
        }
      });
      if (!isFF(FF_CUSTOM_SCRIPT)) {
        entity.dropDraft();
        !entity.sentUserGenerate && entity.sendUserGenerate();
      }
    }

    function skipTask(extraData) {
      if (self.isSubmitting) return;
      handleSubmittingFlag(() => {
        getEnv(self).events.invoke("skipTask", self, extraData);
        self.incrementQueuePosition();
      }, "Error during skip, try again");
    }

    function unskipTask() {
      if (self.isSubmitting) return;
      handleSubmittingFlag(() => {
        getEnv(self).events.invoke("unskipTask", self);
      }, "Error during cancel skipping task, try again");
    }

    function acceptAnnotation() {
      if (self.isSubmitting) return;

      handleSubmittingFlag(async () => {
        const entity = self.annotationStore.selected;

        entity.beforeSend();
        if (!entity.validate()) return;
        if (isFF(FF_CUSTOM_SCRIPT)) {
          const allowedToSave = await getEnv(self).events.invoke("beforeSaveAnnotation", self, entity, {
            event: "acceptAnnotation",
          });
          if (allowedToSave && allowedToSave.some((x) => x === false)) return;
        }

        // changes in current sessions or saved draft should send the result along with approval
        const isDirty = entity.history.canUndo || entity.versions.draft;

        entity.dropDraft();
        await getEnv(self).events.invoke("acceptAnnotation", self, { isDirty, entity });
        self.incrementQueuePosition();
      }, "Error during accept, try again");
    }

    function rejectAnnotation({ comment = null }) {
      if (self.isSubmitting) return;

      handleSubmittingFlag(async () => {
        const entity = self.annotationStore.selected;

        entity.beforeSend();
        if (!entity.validate()) return;
        if (isFF(FF_CUSTOM_SCRIPT)) {
          const allowedToSave = await getEnv(self).events.invoke("beforeSaveAnnotation", self, entity, {
            event: "rejectAnnotation",
          });
          if (allowedToSave && allowedToSave.some((x) => x === false)) return;
        }

        const isDirty = entity.history.canUndo;

        entity.dropDraft();
        await getEnv(self).events.invoke("rejectAnnotation", self, { isDirty, entity, comment });
        self.incrementQueuePosition(-1);
      }, "Error during reject, try again");
    }

    function handleCustomButton(button) {
      if (self.isSubmitting) return;
      const buttonName = button.name;

      handleSubmittingFlag(async () => {
        const entity = self.annotationStore.selected;

        entity.beforeSend();
        // @todo add needsValidation or something like that as a parameter to custom buttons
        // if (!entity.validate()) return;

        const isDirty = entity.history.canUndo;

        await getEnv(self).events.invoke("customButton", self, buttonName, { isDirty, entity, button });
        self.incrementQueuePosition();
        entity.dropDraft();
      }, `Error during handling ${button} button, try again`);
    }

    /**
     * Exchange storage url for presigned url for task
     */
    async function presignUrlForProject(url) {
      // Event invocation returns array of results for all handlers.
      const urls = await self.events.invoke("presignUrlForProject", self, url);

      const presignUrl = urls?.[0];

      return presignUrl;
    }

    /**
     * Reset annotation store
     */
    function resetState() {
      // Tools are attached to the control and object tags
      // and need to be recreated when we st a new task
      ToolsManager.removeAllTools();

      // Same with hotkeys
      Hotkey.unbindAll();
      self.attachHotkeys();
      const oldAnnotationStore = self.annotationStore;

      if (oldAnnotationStore) {
        oldAnnotationStore.beforeReset?.();
        if (isFF(FF_LSDV_4998)) {
          destroySharedStore();
        }
        detach(oldAnnotationStore);
        destroy(oldAnnotationStore);
      }

      self.annotationStore = AnnotationStore.create({ annotations: [] });
      self.initialized = false;
    }

    function resetAnnotationStore() {
      const oldAnnotationStore = self.annotationStore;

      if (oldAnnotationStore) {
        oldAnnotationStore.beforeReset?.();
        oldAnnotationStore.resetAnnotations?.();
      }
    }

    /**
     * Function to initialize annotation store
     * Given annotations and predictions
     * `completions` is a fallback for old projects; they'll be saved as `annotations` anyway
     */
    function initializeStore({ annotations = [], completions = [], predictions = [], annotationHistory }) {
      const as = self.annotationStore;

      // some hacks to properly clear react and mobx structures
      as.afterReset?.();

      if (!as.initialized) {
        as.initRoot(self.config);
        if (isFF(FF_LSDV_4620_3_ML) && !appControls?.isRendered()) {
          appControls?.render();
        }
      }

      // goal here is to deserialize everything fast and select only first annotation
      // no extra processes during eserialization and further processes triggered during select
      if (self.simpleInit) {
        window.STORE_INIT_OK = false;

        // add predictions and annotations to the store;
        // `hidden` will stop them from calling any rendering helpers;
        // correct annotation will be selected at the end and everything will be called inside.
        predictions.forEach((p) => {
          const obj = as.addPrediction(p);
          const results = p.result.map((r) => ({ ...r, origin: "prediction" }));

          obj.deserializeResults(results, { hidden: true });
        });

        [...completions, ...annotations].forEach((c) => {
          const obj = as.addAnnotation(c);

          obj.deserializeResults(c.draft || c.result, { hidden: true });
        });

        window.STORE_INIT_OK = true;
        // simple logging to detect if simple init is used on users' machines
        console.log("LSF: deserialization is finished");

        // next line might be unclear after removing FF_SIMPLE_INIT
        // reversing the list caused problems before when task is reloaded and list is reversed again.
        // AnnotationsCarousel has its own ordering anyway, so we just keep technical order
        // as simple as possible.
        const current = as.annotations.at(-1);
        const currentPrediction = !current && as.predictions.at(-1);

        if (current) {
          as.selectAnnotation(current.id);
          // looks like we still need it anyway, but it's fast and harmless,
          // and we only call it once on already visible annotation
          current.reinitHistory();
        } else if (currentPrediction) {
          as.selectPrediction(currentPrediction.id);
        }

        // annotation history is set when annotation is selected,
        // so no need to set it here
      } else {
        (predictions ?? []).forEach((p) => {
          const obj = as.addPrediction(p);

          as.selectPrediction(obj.id);
          obj.deserializeResults(
            p.result.map((r) => ({
              ...r,
              origin: "prediction",
            })),
          );
        });

        [...(completions ?? []), ...(annotations ?? [])]?.forEach((c) => {
          const obj = as.addAnnotation(c);

          as.selectAnnotation(obj.id);
          obj.deserializeResults(c.draft || c.result);
          obj.reinitHistory();
        });

        const current = as.annotations.at(-1);

        if (current) current.setInitialValues();

        self.setHistory(annotationHistory);
      }

      if (!self.initialized) {
        self.initialized = true;
        getEnv(self).events.invoke("storageInitialized", self);
      }
    }

    function setHistory(history = []) {
      const as = self.annotationStore;

      as.clearHistory();

      // always check that history is for correct and submitted annotation
      if (!history.length || !as.selected?.pk) return;
      if (Number(as.selected.pk) !== Number(history[0].annotation_id)) return;

      (history ?? []).forEach((item) => {
        const obj = as.addHistory(item);

        obj.deserializeResults(item.result ?? [], { hidden: true });
      });
    }

    const setAutoAnnotation = (value) => {
      self._autoAnnotation = value;
      localStorage.setItem("autoAnnotation", value);
    };

    const setAutoAcceptSuggestions = (value) => {
      self._autoAcceptSuggestions = value;
      localStorage.setItem("autoAcceptSuggestions", value);
    };

    const loadSuggestions = flow(function* (request, dataParser) {
      const requestId = guidGenerator();

      self.suggestionsRequest = requestId;

      self.setFlags({ awaitingSuggestions: true });

      try {
        const response = yield request;

        if (requestId === self.suggestionsRequest) {
          self.annotationStore.selected.setSuggestions(dataParser(response));
          self.setFlags({ awaitingSuggestions: false });
        }
      } catch (_e) {
        self.setFlags({ awaitingSuggestions: false });
        // @todo handle errors + situation when task is changed
      }
    });

    function addAnnotationToTaskHistory(annotationId) {
      const taskIndex = self.taskHistory.findIndex(({ taskId }) => taskId === self.task.id);

      if (taskIndex >= 0) {
        self.taskHistory[taskIndex].annotationId = annotationId;
      }
    }

    async function postponeTask() {
      const annotation = self.annotationStore.selected;

      // save draft before postponing; this can be new draft with FF_DEV_4174 off
      // or annotation created from prediction
      await annotation.saveDraft({ was_postponed: true });
      await getEnv(self).events.invoke("nextTask");
      self.incrementQueuePosition();
    }

    function nextTask() {
      if (self.canGoNextTask) {
        const { taskId, annotationId } =
          self.taskHistory[self.taskHistory.findIndex((x) => x.taskId === self.task.id) + 1];

        getEnv(self).events.invoke("nextTask", taskId, annotationId);
        self.incrementQueuePosition();
      }
    }

    function prevTask(_e, shouldGoBack = false) {
      const length = shouldGoBack
        ? self.taskHistory.length - 1
        : self.taskHistory.findIndex((x) => x.taskId === self.task.id) - 1;

      if (self.canGoPrevTask || shouldGoBack) {
        const { taskId, annotationId } = self.taskHistory[length];

        getEnv(self).events.invoke("prevTask", taskId, annotationId);
        self.incrementQueuePosition(-1);
      }
    }

    function setUsers(users) {
      self.users.replace(users);
    }

    // @deprecated use `enrichUsers` instead (as mergeUsers will not update existing users and can lose previous data)
    function mergeUsers(users) {
      self.setUsers(uniqBy([...getSnapshot(self.users), ...users], "id"));
    }

    function enrichUsers(users) {
      const oldUsers = getSnapshot(self.users);
      const oldUsersMap = {};
      oldUsers.forEach((user) => {
        oldUsersMap[user.id] = user;
      });
      const newUsers = users.map((user) => {
        return { ...oldUsersMap[user.id], ...user };
      });
      self.setUsers(uniqBy([...newUsers, ...oldUsers], "id"));
    }

    return {
      setFlags,
      addInterface,
      hasInterface,
      toggleInterface,

      afterCreate,
      assignTask,
      assignConfig,
      resetState,
      resetAnnotationStore,
      initializeStore,
      setHistory,
      attachHotkeys,

      skipTask,
      unskipTask,
      setTaskHistory,
      submitDraft,
      waitForDraftSubmission,
      submitAnnotation,
      updateAnnotation,
      acceptAnnotation,
      rejectAnnotation,
      handleCustomButton,
      presignUrlForProject,
      setUsers,
      mergeUsers,
      enrichUsers,

      showModal,
      toggleComments,
      toggleSettings,
      toggleDescription,

      setAutoAnnotation,
      setAutoAcceptSuggestions,
      loadSuggestions,

      addAnnotationToTaskHistory,
      nextTask,
      prevTask,
      postponeTask,
      incrementQueuePosition,
      beforeDestroy() {
        ToolsManager.removeAllTools();
        appControls = null;
      },

      setAppControls,
      clearApp,
      renderApp,
      selfDestroy() {
        const children = [];

        walk(self, (node) => {
          if (!isRoot(node) && getParent(node) === self) children.push(node);
        });

        let node;

        while ((node = children.shift())) {
          try {
            destroy(node);
          } catch (e) {
            console.log("Problem: ", e);
          }
        }
      },
    };
  });
