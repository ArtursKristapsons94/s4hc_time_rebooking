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

		_oSelectAllButton: null,
		formatter: formatter,
		_busyDialog: new sap.m.BusyDialog(),

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			this._busyDialog.open();
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading")
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			this.setModel(oViewModel, "detailView");

			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onSendEmailPress: function () {
			var oViewModel = this.getModel("detailView");

			URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function (oEvent) {
			var sTitle;
			var iTotalItems = oEvent.getParameter("total");
			var oViewModel = this.getModel("detailView");

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
			var oFIlterGroupItems = this.getView().byId("FBid").getFilterGroupItems();
			for (var i = 0; i <= oFIlterGroupItems.length - 1; i++) {
				oFIlterGroupItems[i].getControl().setValue("");
			}
			this.sObjectId = oEvent.getParameter("arguments").objectId;
			this.prepeareFunctionForDetailViewTable(this.sObjectId);
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			this.getModel().metadataLoaded().then(function () {
				this._oLastItemSelected = null;
				this.prepeareFunctionForDetailViewTableComboBoxProjectID();
				var sObjectPath = this.getModel().createKey("ProjectSet", {
					ProjectID: this.sObjectId
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		prepeareFunctionForDetailViewTable: function (sObjectId) {
			this.getView().getModel("TimeSheetModel").read("/TimeSheetEntryCollection", {
				success: function (oData2) {
					var oODataJSONModel = this.getView().getModel("Payload");
					oODataJSONModel.setData({ mJsonEntity: oData2 });
					this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results;
					this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results.filter(function (sValue) {
						return sValue.TimeSheetDataFields.WBSElement.startsWith(sObjectId);
					});
					this.prepeareFunctionOfAdditionalPropertiesForModelWithSingleReadInModel(this.oJsonForDetailTable);
					this.prepeareFunctionOfAdditionalPropertiesForModelWithDoubleReadInModel(this.oJsonForDetailTable, this.sObjectId);
				}.bind(this)
			});
		},

		prepeareFunctionOfAdditionalPropertiesForModelWithDoubleReadInModel: function () {
			this.getView().getModel("PWAModel").read("/YY1_I_PWA_EXT_API", {
				urlParameters: {
					"$select": "PersonWorkAgreement,BusinessPartner,FirstName,LastName"
				},
				success: function (oData2) {
					var aDataFromStaffingDataSet = oData2.results;
					this.oJsonForDetailTable.map(function (oProperty) {
						var aStaffingEntity = aDataFromStaffingDataSet.filter(function (oValue) {
							return oValue.PersonWorkAgreement === (oProperty.PersonWorkAgreement);
						});
						if (aStaffingEntity[0] !== undefined) {
							oProperty.EmployeeName = aStaffingEntity[0].FirstName + " " + aStaffingEntity[0].LastName;
							oProperty.BusinessPartner = aStaffingEntity[0].BusinessPartner;
						}
					});
					this.getView().getModel("Payload").setData({ EntitySet: this.oJsonForDetailTable });
				}.bind(this)
			});
		},

		prepeareFunctionOfAdditionalPropertiesForModelWithSingleReadInModel: function () {
			this.getView().getModel().read("/WorkpackageSet", {
				urlParameters: {
					"$select": "WorkPackageName,WorkPackageID"
				},
				success: function (oData2) {
					var aDataFromWorkPackageSet = oData2.results;
					this.oJsonForDetailTable.map(function (oProperty) {
						var aWorckpackageEntity = aDataFromWorkPackageSet.filter(function (oValue) {
							return oValue.WorkPackageID === (oProperty.TimeSheetDataFields.WBSElement);
						});
						if (aWorckpackageEntity[0] !== undefined) {
							oProperty.WorkPackageName = aWorckpackageEntity[0].WorkPackageName;
							oProperty.ProjectID = "";
							oProperty.WorkPackage = aWorckpackageEntity[0].WorkPackageID;
						}
					});
					this.getView().getModel("Payload").setData({ EntitySet: this.oJsonForDetailTable });
					var oBindingContext = this.getView().getBindingContext();
					if (oBindingContext !== undefined) {
						var sFirstDayInPreviousMonth = this.firstDayInPreviousMonth(new Date());
						var oFilter = new Filter({
							filters: [
								new Filter("TimeSheetDate", FilterOperator.GE, sFirstDayInPreviousMonth),
								new Filter("TimeSheetStatus", FilterOperator.NE, '60'),
								new Filter("TimeSheetStatus", FilterOperator.NE, '50')
							],
							and: true
						});
						this.byId("lineItemsList").getBinding("items").filter(oFilter, FilterType.Application);
					}
					this.getView().byId("lineItemsList").removeSelections();
					this.getView().byId("saveButtonID").setEnabled(false);
					this._busyDialog.close();
				}.bind(this)
			});
		},

		prepeareFunctionForDetailViewTableComboBoxProjectID: function (myData) {
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.publish("ChannelA", "testEvent", { myData: myData });
		},

		firstDayInPreviousMonth: function (yourDate) {
			return new Date(yourDate.getFullYear(), yourDate.getMonth() - 1, 1);
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
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView();
			var oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath();
			var oResourceBundle = this.getResourceBundle();
			var oObject = oView.getModel().getObject(sPath);
			var sObjectId = oObject.ProjectID;
			var sObjectName = oObject.ChangedBy;
			var oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
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
			var oGlobalBusyDialog = new sap.m.BusyDialog();
			var aSelectedItems = this.getView().byId("lineItemsList").getSelectedItems();
			var oModel = this.getView().getModel("TimeSheetModel");
			oModel.setDeferredGroups(["foo"]);
			var mParameters = {
				groupId: "foo"
			};

			var aDataForUpdate = [];
			aSelectedItems.map(function (oProperty) {
				var oSelectedRowJsonData = oProperty.getBindingContext("Payload").getObject();
				oSelectedRowJsonData.TimeSheetOperation = "U";
				oSelectedRowJsonData.TimeSheetIsReleasedOnSave = true;
				oSelectedRowJsonData.TimeSheetStatus = "10";
				delete oSelectedRowJsonData.WorkPackage;
				delete oSelectedRowJsonData.WorkPackageName;
				delete oSelectedRowJsonData.__metadata;
				delete oSelectedRowJsonData.ProjectID;
				delete oSelectedRowJsonData.TimeSheetDataFields.__metadata;
				delete oSelectedRowJsonData.EmployeeName;
				delete oSelectedRowJsonData.BusinessPartner;
				oSelectedRowJsonData.TimeSheetDataFields.WBSElement = oProperty.getCells()[9].getSelectedKey();
				return aDataForUpdate.push(oSelectedRowJsonData);
			});
			var bState;
			for (var i = 0; i <= aDataForUpdate.length - 1; i++) {
				oModel.create("/TimeSheetEntryCollection", aDataForUpdate[i], mParameters);
				if (aDataForUpdate[i].TimeSheetDataFields.WBSElement === '') {
					bState = false;
				}
			}

			if (bState === false) {
				MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("detailViewValidationMessage"));
			} else {
				oModel.attachEventOnce("batchRequestCompleted", function (response) {
					oGlobalBusyDialog.open();
					if (response.getParameter("requests")[0].success === true) {
						this.prepeareFunctionForDetailViewTable(this.sObjectId);
						MessageBox.success(this.getView().getModel("i18n").getResourceBundle().getText("detailViewSucessMessageAfterSave"));
						oGlobalBusyDialog.close();
					} else {
						var sErrorMessage = JSON.parse(response.getParameter("requests")[0].response.responseText).error.message.value;
						MessageBox.error(sErrorMessage);
						oGlobalBusyDialog.close();
					}
				}.bind(this));
				oModel.submitChanges(mParameters);
			}
		},
		onListSelectProjectIDChange: function (oEvent) {
			var iCurrentCell = oEvent.getSource().getId().split("lineItemsList-")[1];
			var iColumnLength = this.byId("lineItemsList").getColumns().length - 1;
			var oCurrentCell = this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[iColumnLength];
			if (oEvent.getSource().getSelectedItem() !== null) {
				oCurrentCell.setSelectedKey("");
				var aFilter = [];
				aFilter.push(new Filter("WorkPackageID", FilterOperator.StartsWith, oEvent.getSource().getSelectedKey()));
				oCurrentCell.getBinding("items").filter(aFilter);
				oCurrentCell.setEnabled(true);
			} else {
				MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("detailViewSucessMessageAfterSave"));
				oCurrentCell.setSelectedKey("");
				oCurrentCell.setEnabled(false);
			}
		},

		selectionChangeHandler: function (oEvent) {
			if (this._oSelectAllButton === "true") {
				this._oSelectAllButton = null;
				var aSelectedListItems = oEvent.getParameter("listItems");
				for (var i = 0; i < aSelectedListItems.length; i++) {
					aSelectedListItems[i].getCells()[9].setValue("");
					aSelectedListItems[i].getCells()[8].setValue("");
					aSelectedListItems[i].getCells()[9].setEnabled(false);
					aSelectedListItems[i].getCells()[8].setEnabled(false);
				}
			}
			if (oEvent.getParameter("listItem").isSelected() === false) {
				oEvent.getParameter("listItem").getCells()[9].setValue("");
				oEvent.getParameter("listItem").getCells()[8].setValue("");
				oEvent.getParameter("listItem").getCells()[9].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[8].setEnabled(false);
			} else {
				oEvent.getParameter("listItem").getCells()[9].setEnabled(true);
				oEvent.getParameter("listItem").getCells()[8].setEnabled(true);
			}
			if (oEvent.getSource().getSelectedItems().length > 0) {
				this.getView().byId("saveButtonID").setEnabled(true);
			} else {
				this.getView().byId("saveButtonID").setEnabled(false);
			}
			if (oEvent.getSource()._selectAllCheckBox.getSelected() === true) {
				this._oSelectAllButton = "true";
				var aSelectedListItems = oEvent.getParameter("listItems");
				for (var i = 0; i < aSelectedListItems.length; i++) {
					aSelectedListItems[i].getCells()[9].setEnabled(true);
					aSelectedListItems[i].getCells()[8].setEnabled(true);
				}
			}
		},

		onSearch: function (oEvent) {
			var aFilters = [];
			var sFirstDayInPreviousMonth = this.firstDayInPreviousMonth(new Date());
			var fromDateValue = oEvent.getParameter("selectionSet")[0].getDateValue();
			var toDateValue = oEvent.getParameter("selectionSet")[1].getDateValue();
			if (fromDateValue !== null && toDateValue !== null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, fromDateValue, toDateValue));

			}
			if (fromDateValue !== null && toDateValue === null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.GE, fromDateValue));
			}
			if (fromDateValue === null && toDateValue !== null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, sFirstDayInPreviousMonth, toDateValue));
			}
			if (fromDateValue === null && toDateValue === null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.GE, sFirstDayInPreviousMonth));
			}

			if (oEvent.getParameter("selectionSet")[2].getValue() !== null) {
				aFilters.push(new Filter("EmployeeName", FilterOperator.Contains, oEvent.getParameter("selectionSet")[2].getValue()));
			}

			if (oEvent.getParameter("selectionSet")[3].getValue() !== "") {
				aFilters.push(new Filter("EmployeeName", FilterOperator.Contains, oEvent.getParameter("selectionSet")[3].getSelectedKey()));
			}
			if (oEvent.getParameter("selectionSet")[4].getValue() !== "") {
				aFilters.push(new Filter("TimeSheetDataFields/ActivityType", FilterOperator.EQ, oEvent.getParameter("selectionSet")[4].getSelectedKey()));
			}

			aFilters.push(new Filter("TimeSheetStatus", FilterOperator.NE, '60'));
			aFilters.push(new Filter("TimeSheetStatus", FilterOperator.NE, '50'));
			aFilters.push(new Filter("TimeSheetRecord", FilterOperator.NE, ''));

			var oFilter = new Filter({
				filters: aFilters,
				and: true
			});

			this.byId("lineItemsList").getBinding("items").filter(oFilter, FilterType.Application);
		}

	});

});