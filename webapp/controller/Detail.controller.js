sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"sap/m/library",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/ui/model/FilterType"
], function (BaseController, JSONModel, formatter, mobileLibrary, FilterOperator, Filter, MessageBox, FilterType) {
	"use strict";

	// shortcut for sap.m.URLHelper
	var URLHelper = mobileLibrary.URLHelper;

	return BaseController.extend("com.timereporting.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading"),
				busyTable: false,
				delayTable: 0
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			this.setModel(oViewModel, "detailView");

			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
			this.getModel("MasterModel").setODataModels(
				this.getModel(),
				this.getModel("PWAModel"),
				this.getModel("TimeSheetModel"),
				this.getModel("workpackageJSONModel"),
				this.getModel("TimeSheetData")
			);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== *

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function (oEvent) {
			var sTitle;
			var iTotalItems = oEvent.getParameter("total");
			var oViewModel = this.getModel("detailView");

			if (sap.ushell !== undefined) {
				var sFixedHashFromUrl = sap.ushell.services.AppConfiguration.getCurrentApplication().sFixedShellHash;
				if (sFixedHashFromUrl === "#TimeRebooking-Edit") {
					this._setRestrictionsForUserApp();
				}
			}

			// only update the counter if the length is final
			if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
				} else {
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
				}
				oViewModel.setProperty("/lineItemListTitle", sTitle);
			}
		},

		_setRestrictionsForUserApp: function () {
			this.byId("FBfrom").setMinDate(this.firstDayInPreviousMonth(new Date()));
			this.byId("lineItemsList")._selectAllCheckBox.setVisible(false);
			this.byId("lineItemsList").getColumns()[0].setVisible(true);
			this.byId("lineItemsList").getItems().forEach(function (r) {
				var sCurrentCellDate = r.getCells()[0].getBindingContext("TimeSheetData").getObject().TimeSheetDate;
				var sCurrentHours = sCurrentCellDate.getHours();
				sCurrentCellDate.setHours(0);
				if (sCurrentCellDate.getMonth() == new Date().getMonth() || (sCurrentCellDate >= this.firstDayInPreviousMonth(new Date()) && new Date() < this.fifthDayOfCurrentMonth(new Date()))) {
					if (r._oMultiSelectControl) {
						r._oMultiSelectControl.setDisplayOnly(false);
						r.getCells()[0].setVisible(false)
					}
				}
				else {
					if (r._oMultiSelectControl) {
						r._oMultiSelectControl.setDisplayOnly(true);
						r.getCells()[0].setVisible(true);
					}
				}
				sCurrentCellDate.setHours(sCurrentHours);
			}.bind(this))
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.byId("lineItemsList")._selectAllCheckBox.setVisible(false);
			if (performance.navigation.type !== performance.navigation.TYPE_RELOAD) {
				this.getModel("MasterModel").clearFilters();
				this.sObjectId = oEvent.getParameter("arguments").objectId;
				// this.prepeareFunctionForDetailViewTable(this.sObjectId);
				this.getView().getModel("detailView").setProperty("/busyTable", true);
				this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
				this.getModel().metadataLoaded().then(async () => {
					var oFilter = new sap.ui.model.Filter("EmployeeName", FilterOperator.EQ, "tratatatatatat");
					var aFilters = [];
					aFilters.push(oFilter);
					this.byId("lineItemsList").getBinding("items").filter(oFilter);
					this.prepeareFunctionForDetailViewTableComboBoxProjectID();
					try {
						await this.getModel("MasterModel").prepeareComboBoxForWorkpackage(this.sObjectId);
					} finally {
						this.getView().getModel("detailView").setProperty("/busyTable", false);
					}
					var sObjectPath = this.getModel().createKey("ProjectSet", {
						ProjectID: this.sObjectId
					});
					this._bindView("/" + sObjectPath);
				});
			} else {
				this.onCloseDetailPress();
			}
		},

		enrichDataWithTimesheetAPIData: async function (sObjectId) {
			var aFilters = this.getModel("MasterModel").datesFilterFunction();
			var orFilters = [];
			try {
				await this.getModel("MasterModel").readBusinessPartnerToEnrichFilter(orFilters);
			} finally {
				await this.getModel("MasterModel").readTimesheetToCollectData(aFilters, orFilters, sObjectId);
			}
		},

		prepeareFunctionForDetailViewTableComboBoxProjectID: function () {
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.publish("ChannelA", "testEvent");
		},

		firstDayInPreviousMonth: function (yourDate) {
			return new Date(yourDate.getFullYear(), yourDate.getMonth() - 1, 1);
		},

		fifthDayOfCurrentMonth: function (yourDate) {
			return new Date(yourDate.getFullYear(), yourDate.getMonth(), 6);
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this)
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView();
			var oElementBinding = oView.getElementBinding();

			if (!oElementBinding.getBoundContext()) {
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}
		},

		_onMetadataLoaded: function () {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay();
			var oViewModel = this.getModel("detailView");
			var oLineItemTable = this.byId("lineItemsList");
			var iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			oLineItemTable.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function () {
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			// No item should be selected on master after detail page is closed
			this.getOwnerComponent().oListSelector.clearMasterListSelection();
			this.getRouter().navTo("master");
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		toggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		},
		onSave: function () {
			let aSelectedItems = this.getView().byId("lineItemsList").getSelectedItems();
			let oModel = this.getView().getModel("TimeSheetModel");
			oModel.setDeferredGroups(["foo"]);
			let mParameters = {
				groupId: "foo"
			};
			let bDateState = false;
			let bState = false;
			let aDataForUpdate = [];

			this._processSelectedItems(aSelectedItems, aDataForUpdate, bDateState);

			if (bDateState === false) {
				this._confirmSave(bState, mParameters, aDataForUpdate, oModel);
			} else {
				this._saveData(bState, mParameters, aDataForUpdate, oModel);
			}
		},

		_processSelectedItems(aSelectedItems, aDataForUpdate, bDateState) {
			aSelectedItems.map(function (oProperty) {
				let oSelectedRowJsonData = oProperty.getBindingContext("TimeSheetData").getObject();
				let oCurrentProjectRole = oProperty.getCells().find(mCell => { return mCell.sId.includes("comboBoxActivityType") });
				let oCurrentSelectedProject = oProperty.getCells().find(mCell => { return mCell.sId.includes("ProjectID") })
				let oCurrentWorkpackage = oProperty.getCells().find(mCell => { return mCell.sId.includes("comboBoxWorkPackageID") })
				if (oCurrentProjectRole.getSelectedKey() !== '') {
					oSelectedRowJsonData.TimeSheetDataFields.ActivityType = oCurrentProjectRole.getSelectedKey();
					let sAdditionalText = oCurrentProjectRole.getSelectedItem().getAdditionalText();
					if (sAdditionalText.includes("NON_BILL")) {
						oSelectedRowJsonData.TimeSheetDataFields.BillingControlCategory = "NON_BILL";
					} else {
						oSelectedRowJsonData.TimeSheetDataFields.BillingControlCategory = " ";
					}
				}
				let sCurrentHours = oSelectedRowJsonData.TimeSheetDate.getHours();
				oSelectedRowJsonData.TimeSheetDate.setHours(0)
				if (oSelectedRowJsonData.TimeSheetDate.getMonth() == new Date().getMonth() || (oSelectedRowJsonData.TimeSheetDate >= this.firstDayInPreviousMonth(new Date()) && oSelectedRowJsonData.TimeSheetDate < this.fifthDayOfCurrentMonth(new Date()))) {
					bDateState = true;
				}
				if (oCurrentWorkpackage.getSelectedKey() == '' && oCurrentSelectedProject.getSelectedKey() != '') {
					bState = true;
				}
				oSelectedRowJsonData.TimeSheetStatus = "20";
				if (oCurrentWorkpackage.getSelectedKey() !== '') {
					oSelectedRowJsonData.TimeSheetDataFields.WBSElement = oCurrentWorkpackage.getSelectedKey()
				}
				oSelectedRowJsonData.TimeSheetDate.setHours(sCurrentHours)
				oSelectedRowJsonData.TimeSheetOperation = "U";
				return aDataForUpdate.push(oSelectedRowJsonData);
			}.bind(this));
		},

		_confirmSave(bState, mParameters, aDataForUpdate, oModel) {
			MessageBox.confirm(this.getView().getModel("i18n").getResourceBundle().getText("MessageConfirmSave"), {
				actions: ["Post Anyway", "Cancel"],
				emphasizedAction: "Post Anyway",
				onClose: function (sAction) {
					if (sAction === "Post Anyway") {
						this._saveData(bState, mParameters, aDataForUpdate, oModel);
					}
				}.bind(this)
			});
		},

		_saveData(bState, mParameters, aDataForUpdate, oModel) {
			if (bState == false) {
				this.getView().getModel("detailView").setProperty("/busyTable", true);
				for (let i = 0; i <= aDataForUpdate.length - 1; i++) {
					delete aDataForUpdate[i].WorkPackage;
					delete aDataForUpdate[i].WorkPackageName;
					delete aDataForUpdate[i].__metadata;
					delete aDataForUpdate[i].ProjectID;
					delete aDataForUpdate[i].TimeSheetDataFields.__metadata;
					delete aDataForUpdate[i].EmployeeName;
					delete aDataForUpdate[i].BusinessPartner;
					oModel.create("/TimeSheetEntryCollection", aDataForUpdate[i], mParameters);
				}
			} else {
				MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("sErrorMessageWbsElement"));
			}
			if (bState == false) {
				oModel.attachEventOnce("batchRequestCompleted", function (response) {
					if (response.getParameter("requests")[0].success === true) {
						this.searchFunctonality();
						MessageBox.success(this.getView().getModel("i18n").getResourceBundle().getText("detailViewSucessMessageAfterSave"));
						this.byId("lineItemsList").removeSelections();
					} else {
						let sErrorMessage = JSON.parse(response.getParameter("requests")[0].response.responseText).error.message.value;
						MessageBox.error(sErrorMessage);
					}
				}.bind(this));
				oModel.submitChanges(mParameters);
			}
		},
		onListSelectProjectIDChange: function (oEvent) {
			var iCurrentCell = oEvent.getSource().getId().split("lineItemsList-")[1];
			var oCurrentCellWBS = this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells").find(mCell => { return mCell.sId.includes("comboBoxWorkPackageID") })
			if (oEvent.getSource().getSelectedItem() !== null) {
				oCurrentCellWBS.setSelectedKey("");
				var aFilter = [];
				aFilter.push(new Filter("WorkPackageID", FilterOperator.StartsWith, oEvent.getSource().getSelectedKey()));
				oCurrentCellWBS.getBinding("items").filter(aFilter);
				oCurrentCellWBS.setEnabled(true);
			} else {
				oCurrentCellWBS.setSelectedKey("");
				oCurrentCellWBS.setEnabled(false);
			}
			if (this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells").find(mCell => { return mCell.sId.includes("comboBoxActivityType") }).getEnabled() === true) {
				this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells").find(mCell => { return mCell.sId.includes("comboBoxActivityType") }).setSelectedKey("");
			}
		},

		onListSelectWorkpackageChange: function (oEvent) {
			var iCurrentCell = oEvent.getSource().getId().split("lineItemsList-")[1];
			var oCurrentCell = this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells").find(mCell => { return mCell.sId.includes("comboBoxActivityType") });
			oCurrentCell.setSelectedKey("");
			oCurrentCell.setEnabled(true);
			var sWorkPackageID = oEvent.getSource().getSelectedItem().getText();
			var sPlanDataSetPath = this.getModel().createKey("WorkpackageSet", {
				WorkPackageID: sWorkPackageID
			});
			this.getView().getModel().read("/" + sPlanDataSetPath + "/PlanDataSet", {
				success: function (oData2) {
					var oDataJsonModelComboBoxRoles = this.getView().getModel("PayloadComboBoxRoles");
					oDataJsonModelComboBoxRoles.setData({ mRolesEntity: oData2.results });
					var aItems = oDataJsonModelComboBoxRoles.getData().mRolesEntity;
					aItems = aItems.filter((value, index, self) =>
						index === self.findIndex((t) => (
							t.BillingControlCategory === value.BillingControlCategory && t.DelvryServOrg === value.DelvryServOrg && t.ResourceId === value.ResourceId
						))
					)
					oDataJsonModelComboBoxRoles.setData({ mRolesEntity: aItems });
				}.bind(this)
			});
		},

		selectionChangeHandler: function (oEvent) {
			let listItem = oEvent.getParameter("listItem");
			let cells = listItem.getCells();
			let enableFields = ["noteInput", "externalTicketInput", "internalTicketInput", "ProjectID", "costCenterInput"];
			if (listItem.isSelected()) {
				enableFields.forEach(field => {
					cells.find(mCell => mCell.sId.includes(field)).setEnabled(true);
				});
			} else {
				let enableFields = ["noteInput", "externalTicketInput", "internalTicketInput", "ProjectID", "comboBoxWorkPackageID", "comboBoxActivityType", "costCenterInput"];
				enableFields.forEach(field => {
					cells.find(mCell => mCell.sId.includes(field)).setEnabled(false);
					if (field === "ProjectID" || field === "comboBoxWorkPackageID") cells.find(mCell => mCell.sId.includes(field)).setValue("");
				});
			}
			this.getView().byId("saveButtonID").setEnabled(oEvent.getSource().getSelectedItems().length > 0);
		},
		onSearch: function (oEvent) {
			var mFilters = this.getModel("MasterModel").getProperty("/Filters");
			if (!mFilters.DateFrom || !mFilters.DateTo || !mFilters.Employee) {
				MessageBox.confirm(this.getView().getModel("i18n").getResourceBundle().getText("MessageConfirmSearch"), {
					actions: ["Search Anyway", "Cancel"],
					emphasizedAction: "Search Anyway",
					onClose: function (sAction) {
						if (sAction === "Search Anyway") {
							this.searchFunctonality()
						}
					}.bind(this)
				})
			} else {
				this.searchFunctonality()
			}
		},

		searchFunctonality: async function () {
			this.getView().getModel("detailView").setProperty("/busyTable", true);
			await this.enrichDataWithTimesheetAPIData(this.sObjectId);
			await Promise.all([
				this.getModel("MasterModel").enrichDataWithEmployeeName(),
				this.getModel("MasterModel").enrichDataWithWorkPackage(this.sObjectId)
			]).then(() => {
				const oTemplate = this.byId("lineItemsList").getBindingInfo("items").template
				this.byId("lineItemsList").unbindAggregation("items");
				this.byId("lineItemsList").bindItems({
					path: "TimeSheetData>/",
					template: oTemplate
				});
				this.applyFilters();
				this.getView().getModel("detailView").setProperty("/busyTable", false);
			})
		},

		applyFilters: function () {
			this.enableComboBoxAfterFilteringFunction();
			this.byId("lineItemsList").removeSelections();
			const oFilter = this.getModel("MasterModel").applyFilters();

			this.byId("lineItemsList").getBinding("items").filter(oFilter, FilterType.Application);
			this.getView().getModel("detailView").setProperty("/busyTable", false);
		},

		enableComboBoxAfterFilteringFunction: function () {
			var aSelectedListItems = this.byId("lineItemsList").getSelectedItems();
			this.getView().byId("saveButtonID").setEnabled(false);
			aSelectedListItems.map(item => item.getCells()
				.filter(cell => cell.sId.includes("noteInput") || cell.sId.includes("externalTicketInput") || cell.sId.includes("internalTicketInput") || cell.sId.includes("ProjectID") || cell.sId.includes("comboBoxWorkPackageID") || cell.sId.includes("comboBoxActivityType") || cell.sId.includes("costCenterInput"))
				.forEach(cell => {
					cell.setEnabled(false);
					cell.setSelectedKey(false);
					cell.setValue("");
				})
			);
		}

	});

});