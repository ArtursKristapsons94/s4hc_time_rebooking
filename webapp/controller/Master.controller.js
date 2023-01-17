sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/Sorter",
	"sap/ui/model/FilterOperator",
	"sap/m/GroupHeaderListItem",
	"sap/ui/Device",
	"../model/formatter",
	"sap/ui/model/FilterType",
	"sap/m/MessageBox"
], function (BaseController, JSONModel, Filter,
	Sorter, FilterOperator, GroupHeaderListItem, Device, formatter, FilterType, MessageBox) {
	"use strict";

	return BaseController.extend("com.timereporting.controller.Master", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit: function () {
			// Control state model
			this.getRouter().navTo("master");
			var oList = this.byId("list");
			var oViewModel = this._createViewModel();
			// var iOriginalBusyDelay = oList.getBusyIndicatorDelay();
			this._oList = oList;
			// keeps the filter and search state
			this._oListFilterState = {
				aFilter: [],
				aSearch: []
			};
			var oJsonModel = this._createViewModel();
			this.setModel(oJsonModel, "masterJsonList");

			this.setModel(oViewModel, "masterView");
			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oList.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for the list
				// oViewModel.setProperty("/delay", iOriginalBusyDelay);
				oViewModel.setProperty("/busyTable", true);
			});

			this.getView().addEventDelegate({
				onBeforeFirstShow: function () {
					this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
				}.bind(this)
			});

			this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.subscribe("ChannelA", "testEvent", this.getVisibleItemsFn, this);
		},

		onExit: function () {
			var eventBus = sap.ui.getCore().getEventBus();
			eventBus.unsubscribe("ChannelA", "testEvent", this.getVisibleItemsFn, this);
		},

		getVisibleItemsFn: function () {
			this.getView().getModel().read("/ProjectSet", {
				filters: [new Filter({
					path: "ProjectStage",
					operator: FilterOperator.EQ,
					value1: "P003"
				})],
				success: function (oData) {
					var mJsonForComboxBoxProjectId = oData.results.map(function (oProperty) {
						return { "ProjectID": oProperty.ProjectID, "ProjectName": oProperty.ProjectName };
					});
					var oODataJSONModelForComboBox = this.getView().getModel("PayloadComboBox");
					oODataJSONModelForComboBox.setSizeLimit(2000);
					oODataJSONModelForComboBox.setData({ ProjectSet: mJsonForComboxBoxProjectId });
				}.bind(this)
			});
		},


		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * After list data is available, this handler method updates the
		 * master list counter
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function (oEvent) {
			this.getView().byId("list").removeSelections();
			// update the master list object counter after new data is loaded
			this._updateListItemCount();
			if (sap.ushell !== undefined) {
				var sFixedHashFromUrl = sap.ushell.services.AppConfiguration.getCurrentApplication().sFixedShellHash;
				if (sFixedHashFromUrl === "#TimeRebooking-Edit") {
					this.byId("list").setGrowing(false);
				}
			}
		},

		/**
		 * Event handler for the master search field. Applies current
		 * filter value and triggers a new search. If the search field's
		 * 'refresh' button has been pressed, no new search is triggered
		 * and the list binding is refresh instead.
		 * @param {sap.ui.base.Event} oEvent the search event
		 * @public
		 */
		onSearch: function (oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any master list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
				return;
			}

			var sQuery = oEvent.getParameter("query");

			if (sQuery) {
				var orFilters = new Filter({
					filters: [
						new Filter("ProjectName", FilterOperator.Contains, sQuery),
						new Filter("ProjectID", FilterOperator.Contains, sQuery),
					],
					and: false
				});
				this._oListFilterState.aSearch = new Filter({
					filters: [
						new Filter("ProjectStage", FilterOperator.EQ, "P003"),
						orFilters
					],
					and: true
				});
				this.byId("list").getBinding("items").filter(this._oListFilterState.aSearch, FilterType.Application);
			} else {
				this._oListFilterState.aSearch = [new Filter("ProjectStage", FilterOperator.EQ, "P003")];
				this._applyFilterSearch();
			}
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			this._oList.getBinding("items").refresh();
		},

		/**
		 * Event handler for the filter, sort and group buttons to open the ViewSettingsDialog.
		 * @param {sap.ui.base.Event} oEvent the button press event
		 * @public
		 */

		/**
		 * Event handler called when ViewSettingsDialog has been confirmed, i.e.
		 * has been closed with 'OK'. In the case, the currently chosen filters, sorters or groupers
		 * are applied to the master list, which can also mean that they
		 * are removed from the master list, in case they are
		 * removed in the ViewSettingsDialog.
		 * @param {sap.ui.base.Event} oEvent the confirm event
		 * @public
		 */
		onConfirmViewSettingsDialog: function (oEvent) {

			this._applySortGroup(oEvent);
		},

		/**
		 * Apply the chosen sorter and grouper to the master list
		 * @param {sap.ui.base.Event} oEvent the confirm event
		 * @private
		 */
		_applySortGroup: function (oEvent) {
			var mParams = oEvent.getParameters();
			var sPath;
			var bDescending;
			var aSorters = [];
			sPath = mParams.sortItem.getKey();
			bDescending = mParams.sortDescending;
			aSorters.push(new Sorter(sPath, bDescending));
			this._oList.getBinding("items").sort(aSorters);
		},

		/**
		 * Event handler for the list selection event
		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
		 * @public
		 */
		onSelectionChange: function (oEvent) {
			var oList = oEvent.getSource();
			var bSelected = oEvent.getParameter("selected");

			// skip navigation when deselecting an item in multi selection mode
			if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
				// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
				this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
			}
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
		 * If there was an object selected in the master list, that selection is removed.
		 * @public
		 */
		onBypassed: function () {
			this._oList.removeSelections(true);
		},

		/**
		 * Used to create GroupHeaders with non-capitalized caption.
		 * These headers are inserted into the master list to
		 * group the master list's items.
		 * @param {Object} oGroup group whose text is to be displayed
		 * @public
		 * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
		 */
		createGroupHeader: function (oGroup) {
			return new GroupHeaderListItem({
				title: oGroup.text,
				upperCase: false
			});
		},

		/**
		 * Event handler for navigating back.
		 * We navigate back in the browser historz
		 * @public
		 */
		onNavBack: function () {
			history.go(-1);
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_createViewModel: function () {
			return new JSONModel({
				isFilterBarVisible: false,
				filterBarLabel: "",
				delay: 0,
				busy: false,
				busyTable: false,
				title: this.getResourceBundle().getText("masterTitleCount", [0]),
				noDataText: this.getResourceBundle().getText("masterListNoDataText"),
				sortBy: "ChangedBy",
				groupBy: "None"
			});
		},

		_onMasterMatched: function () {
			this.getModel("appView").setProperty("/layout", "OneColumn");
			this._getProjects();
		},

		_getProjects: function () {
			if (sap.ushell !== undefined) {
				var sFixedHashFromUrl = sap.ushell.services.AppConfiguration.getCurrentApplication().sFixedShellHash;
				if (sFixedHashFromUrl === "#TimeRebooking-Edit") {
					var sBusinessPartnerID = sap.ushell.Container.getService("UserInfo").getId().substring(2);
					this._getProjectsByUserId(sBusinessPartnerID);
				} else {
					this._getAllProjects();
				}
			} else {
				this._getAllProjects();
			}
		},

		_getProjectsByUserId: function (sBusinessPartnerID) {
			this.getView().getModel().read("/ProjectRoleSet", {
				urlParameters: {
					"$select": "BusinessPartnerID,ProjectID"
				},
				filters: [
					new Filter({
						path: "BusinessPartnerID",
						operator: FilterOperator.EQ,
						value1: sBusinessPartnerID
					})],
				success: function (oData) {
					var aProjects = oData.results.map(item => item.ProjectID)
						.filter((value, index, self) => self.indexOf(value) === index);
					if (aProjects[0] != undefined) {
						this._getProjectsWithFilter(aProjects);
					} else {
						MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("sErrorMessageNoProjects"));
						this.getView().getModel("masterView").setProperty("/busyTable", false);
					}
				}.bind(this)
			});
		},

		_getAllProjects: function () {
			this.getView().getModel().read("/ProjectSet", {
				urlParameters: {
					"$select": "ProjectName,ProjectID,ProjectStage"
				},
				filters: [
					new Filter({
						path: "ProjectStage",
						operator: FilterOperator.EQ,
						value1: "P003"
					})],
				success: function (oData) {
					var oODataJSONModel = this.getView().getModel("masterJsonList");
					oODataJSONModel.setData({ mJsonEntity: oData.results });
					this.getView().getModel("masterView").setProperty("/busyTable", false);
				}.bind(this)
			});
		},

		_getProjectsWithFilter: function (aProjects) {
			var aFilters = [];
			for (var iRowIndex = 0; iRowIndex < aProjects.length; iRowIndex++) {
				var oFilter = new sap.ui.model.Filter("ProjectID", sap.ui.model.FilterOperator.EQ, aProjects[iRowIndex]);
				aFilters.push(oFilter);
			}
			this.getView().getModel().read("/ProjectSet", {
				urlParameters: {
					"$select": "ProjectName,ProjectID,ProjectStage"
				},
				filters: [
					new Filter({
						filters: aFilters,
						and: false
					}),
					new Filter({
						path: "ProjectStage",
						operator: FilterOperator.EQ,
						value1: "P003"

					})
				],
				success: function (oData) {
					var oODataJSONModel = this.getView().getModel("masterJsonList");
					oODataJSONModel.setData({ mJsonEntity: oData.results });
					this.getView().getModel("masterView").setProperty("/busyTable", false);
				}.bind(this)
			});
		},

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function (oItem) {
			var bReplace = !Device.system.phone;
			// set the layout property of FCL control to show two columns
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			this.getRouter().navTo("object", {
				objectId: oItem.getAttributes()[0].getText()
			});
		},

		/**
		 * Sets the item count on the master list header
		 * @param {integer} iTotalItems the total number of items in the list
		 * @private
		 */
		_updateListItemCount: function () {
			var sTitle;
			// only update the counter if the length is final
			if (this._oList.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("masterTitleCount", [this._oList.getVisibleItems().length]);
				this.getModel("masterView").setProperty("/title", sTitle);
			}
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @private
		 */
		_applyFilterSearch: function () {
			var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter);
			var oViewModel = this.getModel("masterView");
			this._oList.getBinding("items").filter(aFilters, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aFilters.length !== 0) {
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was triggered
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
			}
		},

		/**
		 * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
		 * @param {string} sFilterBarText the selected filter value
		 * @private
		 */
		_updateFilterBar: function (sFilterBarText) {
			var oViewModel = this.getModel("masterView");
			oViewModel.setProperty("/isFilterBarVisible", (this._oListFilterState.aFilter.length > 0));
			oViewModel.setProperty("/filterBarLabel", this.getResourceBundle().getText("masterFilterBarText", [sFilterBarText]));
		}

	});

});