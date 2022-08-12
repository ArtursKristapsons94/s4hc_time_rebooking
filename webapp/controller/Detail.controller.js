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

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
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
			// this.getView().byId("comboBoxProjectID").setFilterFunction(function(sTerm, oItem) {
			// 	// A case-insensitive 'string contains' filter
			// 	return oItem.getText().match(new RegExp(sTerm, "i")) || oItem.getKey().match(new RegExp(sTerm, "i"));
			// });
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

			if (sap.ushell !== undefined) {
				var sFixedHashFromUrl = sap.ushell.services.AppConfiguration.getCurrentApplication().sFixedShellHash;
				if (sFixedHashFromUrl === "#TimeRebooking-Edit") {
					this.byId("FBfrom").setMinDate(this.firstDayInPreviousMonth(new Date()));
					this.byId("lineItemsList")._selectAllCheckBox.setVisible(false);
					this.byId("lineItemsList").getColumns()[0].setVisible(true);
					this.byId("lineItemsList").getItems().forEach(function (r) {
						var sCurrentCellDate = r.getCells()[0].getBindingContext("Payload").getObject().TimeSheetDate;
						var sCurrentHours = sCurrentCellDate.getHours();
						sCurrentCellDate.setHours(0);
						if (sCurrentCellDate.getMonth() == new Date().getMonth() || (sCurrentCellDate >= this.firstDayInPreviousMonth(new Date()) && new Date() < this.fifthDayOfCurrentMonth(new Date()))) {
							r._oMultiSelectControl.setDisplayOnly(false);
							r.getCells()[0].setVisible(false)
						}
						else {
							r._oMultiSelectControl.setDisplayOnly(true);
							r.getCells()[0].setVisible(true);
						}
						sCurrentCellDate.setHours(sCurrentHours);
					}.bind(this))
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
			if (performance.navigation.type !== performance.navigation.TYPE_RELOAD) {
				var oFIlterGroupItems = this.getView().byId("FBid").getFilterGroupItems();
				for (var i = 0; i <= oFIlterGroupItems.length - 1; i++) {
					oFIlterGroupItems[i].getControl().setValue("");
				}
				this.sObjectId = oEvent.getParameter("arguments").objectId;
				// this.prepeareFunctionForDetailViewTable(this.sObjectId);
				this.getView().getModel("detailView").setProperty("/busyTable", true);
				this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
				this.getModel().metadataLoaded().then(function () {
					this._oLastItemSelected = null;
					var oFilter = new sap.ui.model.Filter("EmployeeName", FilterOperator.EQ, "tratatatatatat");
					var aFilters = [];
					aFilters.push(oFilter);
					this.byId("lineItemsList").getBinding("items").filter(oFilter);
					this.prepeareFunctionForDetailViewTableComboBoxProjectID();
					this.prepeareComboBoxForWorkpackage(this.sObjectId);
					var sObjectPath = this.getModel().createKey("ProjectSet", {
						ProjectID: this.sObjectId
					});
					this._bindView("/" + sObjectPath);
				}.bind(this));
			} else {
				this.onCloseDetailPress();
			}
		},

		onDataReceived: function () {
			debugger;
			this.getView().getModel("detailView").setProperty("/busy", false);
		},

		prepeareComboBoxForWorkpackage: function (sObjectId) {
			var sPath = "/ProjectSet" + "('" + sObjectId + "')" + "/WorkpackageSet"
			this.getView().getModel().read(sPath, {
				urlParameters: {
					"$select": "WorkPackageName,WorkPackageID"
				},
				success: function (oData2) {
					var oODataJSONModel = this.getView().getModel("PayloadWbsComboBox");
					oODataJSONModel.setData({ workpackageEntity: oData2.results });
					this.getView().getModel("detailView").setProperty("/busyTable", false);
				}.bind(this)
			});
		},


		// modelForBusyAndDoubleRead: function () {
		// 	var promise2 = this.prepeareFunctionOfAdditionalPropertiesForModelWithSingleReadInModel(this.oJsonForDetailTable);
		// 	var promise3 = this.prepeareFunctionOfAdditionalPropertiesForModelWithDoubleReadInModel(this.oJsonForDetailTable, this.sObjectId);
		// 	// var promise3 = new Promise((resolve, reject) => {
		// 	// 	resolve(this.prepeareModelForPurchaseOrder());
		// 	// });
		// 	Promise.all([promise2, promise3]).then((values) => {
		// 		this.getView().getModel("detailView").setProperty("/busyTable", false);
		// 	});
		// },


		prepeareFunctionForDetailViewTable: function (sObjectId, resolve) {
			// var sFixedHashFromUrl = sap.ushell.services.AppConfiguration.getCurrentApplication().sFixedShellHash;
			// if (sFixedHashFromUrl === "#TimeRebooking-Edit") {
			// 	var sFirstDateInPreviousMonth = this.firstDayInPreviousMonth(new Date());
			// 	this.getView().getModel("TimeSheetModel").read("/TimeSheetEntryCollection", {
			// 		urlParameters: {
			// 			"$select": "TimeSheetDataFields,TimeSheetRecord,PersonWorkAgreement,TimeSheetDate,TimeSheetStatus,YY1_ExtTicketNummer_TIM,YY1_InterneTicketNr_TIM,TimeSheetOperation"
			// 		},
			// 		filters: [
			// 			new Filter({
			// 				path: "TimeSheetDate",
			// 				operator: FilterOperator.StartsWith,
			// 				value1: sFirstDateInPreviousMonth
			// 			})],
			// 		success: function (oData2) {
			// 			var oODataJSONModel = this.getView().getModel("Payload");
			// 			oODataJSONModel.setData({ mJsonEntity: oData2 });
			// 			this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results;
			// 			this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results.filter(function (sValue) {
			// 				return sValue.TimeSheetDataFields.WBSElement.startsWith(sObjectId);
			// 			});
			// 			this.modelForBusyAndDoubleRead();
			// 		}.bind(this)
			// 	});
			// } else {
			var aFilters = [];
			this.datesFilterFunction(aFilters);
			var oFilters = [];
			var orFilters = [];
			if (this.byId("FBid").getFilterGroupItems()[2].getControl().getValue() !== '') {
				var sValuesForFilter = this.byId("FBid").getFilterGroupItems()[2].getControl().getValue().split(" ");
				oFilters.push(new Filter("FirstName", FilterOperator.Contains, sValuesForFilter[0]));
				if(sValuesForFilter[1] !== undefined) {
					oFilters.push(new Filter("LastName", FilterOperator.Contains, sValuesForFilter[1]));
				}
				return new Promise(function (resolve, reject) {
					this.getView().getModel("PWAModel").read("/YY1_I_PWA_EXT_API", {
						urlParameters: {
							"$select": "PersonWorkAgreement,BusinessPartner,FirstName,LastName"
						},
						filters: [
							new Filter({
								filters: oFilters,
								and: false
							})
						],
						success: function (oData2) {
							oData2.results.map(function (oProperty) {
									return orFilters.push(new Filter("PersonWorkAgreement", FilterOperator.EQ, oProperty.PersonWorkAgreement));
								});
								aFilters.push(new sap.ui.model.Filter(orFilters, false));
								this.getView().getModel("TimeSheetModel").read("/TimeSheetEntryCollection", {
									// urlParameters: {
									// 	"$select": "TimeSheetDataFields,TimeSheetRecord,PersonWorkAgreement,TimeSheetDate,TimeSheetStatus,YY1_ExtTicketNummer_TIM,YY1_InterneTicketNr_TIM,TimeSheetOperation"
									// },
									filters: [
										new Filter({
											filters: aFilters,
											and: true,
										})
									],
									success: function (oData2) {
										var oODataJSONModel = this.getView().getModel("Payload");
										oODataJSONModel.setData({ mJsonEntity: oData2 });
										this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results;
										this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results.filter(function (sValue) {
											return sValue.TimeSheetDataFields.WBSElement.startsWith(sObjectId);
										});
										// this.modelForBusyAndDoubleRead();
										resolve(oData2)
				
									}.bind(this)
								});
						}.bind(this)
					});
				}.bind(this));
			} else {
				return new Promise(function (resolve, reject) {
					this.getView().getModel("TimeSheetModel").read("/TimeSheetEntryCollection", {
						// urlParameters: {
						// 	"$select": "TimeSheetDataFields,TimeSheetRecord,PersonWorkAgreement,TimeSheetDate,TimeSheetStatus,YY1_ExtTicketNummer_TIM,YY1_InterneTicketNr_TIM,TimeSheetOperation"
						// },
						filters: [
							new Filter({
								filters: aFilters,
								and: false
							})
						],
						success: function (oData2) {
							var oODataJSONModel = this.getView().getModel("Payload");
							oODataJSONModel.setData({ mJsonEntity: oData2 });
							this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results;
							this.oJsonForDetailTable = oODataJSONModel.getData().mJsonEntity.results.filter(function (sValue) {
								return sValue.TimeSheetDataFields.WBSElement.startsWith(sObjectId);
							});
							// this.modelForBusyAndDoubleRead();
							resolve(oData2)
	
						}.bind(this)
					});
				}.bind(this));
			}
		},

		prepeareModelForPurchaseOrder: function () {
			this.getView().getModel("POService").read("/A_PurchaseOrderItem", {
				urlParameters: {
					"$select": "PurchaseOrder,IsCompletelyDelivered,PurchaseOrderItem"
				},
				filters: [
					new Filter({
						path: "IsCompletelyDelivered",
						operator: FilterOperator.EQ,
						value1: false
					})],
				success: function (oData) {
					var mJsonForComboxPO = oData.results.map(function (oProperty) {
						return { "PurchaseOrder": oProperty.PurchaseOrder, "IsCompletelyDelivered": oProperty.IsCompletelyDelivered, "PurchaseOrderItem": oProperty.PurchaseOrderItem };
					});
					this.getView().getModel("POService").read("/A_PurOrdAccountAssignment", {
						urlParameters: {
							"$select": "PurchaseOrder,PurchaseOrderItem,WBSElement"
						},
						success: function (oData2) {
							mJsonForComboxPO.map(function (oProperty) {
								var aPurchaseOrder = oData2.results.filter(function (oValue) {
									return oValue.PurchaseOrder === oProperty.PurchaseOrder && oValue.PurchaseOrderItem == oProperty.PurchaseOrderItem;
								});
								if (aPurchaseOrder[0] !== undefined) {
									oProperty.WorkPackageID = aPurchaseOrder[0].WBSElement;
								}
							});
							var oODataJSONModelForComboBox = this.getView().getModel("PayloadPurchaseOrder");
							oODataJSONModelForComboBox.setData({ PoSet: mJsonForComboxPO });
						}.bind(this)
					});
				}.bind(this)
			});
		},

		prepeareFunctionOfAdditionalPropertiesForModelWithDoubleReadInModel: function (resolve) {
			return new Promise(function (resolve, reject) {
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
						resolve(oData2);
					}.bind(this)
				});
			}.bind(this));
		},

		prepeareFunctionOfAdditionalPropertiesForModelWithSingleReadInModel: function (resolve) {
			return new Promise(function (resolve, reject) {
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
						resolve(oData2);
						this.getView().getModel("Payload").setData({ EntitySet: this.oJsonForDetailTable });
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

						this.getView().byId("lineItemsList").removeSelections();
						this.getView().byId("saveButtonID").setEnabled(false);
					}.bind(this)
				});
			}.bind(this));
		},

		prepeareFunctionForDetailViewTableComboBoxProjectID: function (myData) {
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.publish("ChannelA", "testEvent", { myData: myData });
		},

		firstDayInPreviousMonth: function (yourDate) {
			return new Date(yourDate.getFullYear(), yourDate.getMonth() - 1, 1);
		},

		PreviousThreeMonth: function (yourDate) {
			return new Date(yourDate.getFullYear(), yourDate.getMonth() - 3, 1);
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
			var bDateState = false;
			var bState = false;
			var aDataForUpdate = [];
			aSelectedItems.map(function (oProperty, iValue) {
				var oSelectedRowJsonData = oProperty.getBindingContext("Payload").getObject();
				if (oProperty.getCells()[13].getSelectedKey() !== '') {
					oSelectedRowJsonData.TimeSheetDataFields.ActivityType = oProperty.getCells()[13].getSelectedKey();
					var sAdditionalText = oProperty.getCells()[13].getSelectedItem().getAdditionalText();
					if (sAdditionalText.includes("NON_BILL")) {
						oSelectedRowJsonData.TimeSheetDataFields.BillingControlCategory = "NON_BILL";
					} else {
						oSelectedRowJsonData.TimeSheetDataFields.BillingControlCategory = " ";
					}
				}
				if (oProperty.getCells()[14].getSelectedKey() !== '') {
					oSelectedRowJsonData.TimeSheetDataFields.PurchaseOrder = oProperty.getCells()[14].getSelectedKey();
					oSelectedRowJsonData.TimeSheetDataFields.PurchaseOrderItem = oProperty.getCells()[14].getSelectedItem().getAdditionalText();
				}
				var sCurrentHours = oSelectedRowJsonData.TimeSheetDate.getHours();
				oSelectedRowJsonData.TimeSheetDate.setHours(0)
				if (oSelectedRowJsonData.TimeSheetDate.getMonth() == new Date().getMonth() || (oSelectedRowJsonData.TimeSheetDate >= this.firstDayInPreviousMonth(new Date()) && oSelectedRowJsonData.TimeSheetDate < this.fifthDayOfCurrentMonth(new Date()))) {
					bDateState = true;
				}
				if (this.byId("lineItemsList").getSelectedItems()[iValue].getCells()[12].getSelectedKey() == '' && this.byId("lineItemsList").getSelectedItems()[iValue].getCells()[11].getSelectedKey() != '') {
					bState = true;
				}
				oSelectedRowJsonData.TimeSheetStatus = "20";
				if (oProperty.getCells()[12].getSelectedKey() !== '') {
					oSelectedRowJsonData.TimeSheetDataFields.WBSElement = oProperty.getCells()[12].getSelectedKey()
				}
				oSelectedRowJsonData.TimeSheetDate.setHours(sCurrentHours)
				oSelectedRowJsonData.TimeSheetOperation = "U";
				return aDataForUpdate.push(oSelectedRowJsonData);
			}.bind(this));
			if (bDateState === false) {
				MessageBox.confirm(this.getView().getModel("i18n").getResourceBundle().getText("MessageConfirmSave"), {
					actions: ["Post Anyway", "Cancel"],
					emphasizedAction: "Post Anyway",
					onClose: function (sAction) {
						if (sAction === "Post Anyway") {
							if (bState == false) {
								this.getView().getModel("detailView").setProperty("/busyTable", true);
								for (var i = 0; i <= aDataForUpdate.length - 1; i++) {
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
										this.byId("lineItemsList").removeSelections()
									} else {
										var sErrorMessage = JSON.parse(response.getParameter("requests")[0].response.responseText).error.message.value;
										MessageBox.error(sErrorMessage);
									}
								}.bind(this));
								oModel.submitChanges(mParameters);
							}
						}
					}.bind(this)
				});
			} else {
				if (bState == false) {
					this.getView().getModel("detailView").setProperty("/busyTable", true);
					for (var i = 0; i <= aDataForUpdate.length - 1; i++) {
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
							var sErrorMessage = JSON.parse(response.getParameter("requests")[0].response.responseText).error.message.value;
							MessageBox.error(sErrorMessage);
						}
					}.bind(this));
					oModel.submitChanges(mParameters);
				}
			}
		},
		onListSelectProjectIDChange: function (oEvent) {
			var iCurrentCell = oEvent.getSource().getId().split("lineItemsList-")[1];
			var oCurrentCellWBS = this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[12];
			if (oEvent.getSource().getSelectedItem() !== null) {
				oCurrentCellWBS.setSelectedKey("");
				var aFilter = [];
				aFilter.push(new Filter("WorkPackageID", FilterOperator.StartsWith, oEvent.getSource().getSelectedKey()));
				oCurrentCellWBS.getBinding("items").filter(aFilter);
				oCurrentCellWBS.setEnabled(true);
			} else {
				// MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("detailViewValidationMessage"));
				oCurrentCellWBS.setSelectedKey("");
				oCurrentCellWBS.setEnabled(false);
			}
			if (this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[13].getEnabled() === true) {
				this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[13].setSelectedKey("");
			}
		},

		onListSelectWorkpackageChange: function (oEvent) {
			var iCurrentCell = oEvent.getSource().getId().split("lineItemsList-")[1];
			var oCurrentCell = this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[13];
			oCurrentCell.setSelectedKey("");
			oCurrentCell.setEnabled(true);
			var sWorkPackageID = oEvent.getSource().getSelectedItem().getText();
			var sPlanDataSetPath = this.getModel().createKey("WorkpackageSet", {
				WorkPackageID: sWorkPackageID
			});
			var oCurrentCellPo = this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[14];
			if (oEvent.getSource().getSelectedItem() !== null) {
				var aFilter = [];
				aFilter.push(new Filter("WorkPackageID", FilterOperator.EQ, sWorkPackageID));
				oCurrentCellPo.getBinding("items").filter(aFilter);
				oCurrentCellPo.setEnabled(true);
			} else {
				// MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("detailViewValidationMessage"));
				oCurrentCellPo.setSelectedKey("");
				oCurrentCellPo.setEnabled(false);
			}
			if (this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[14].getEnabled() === true) {
				this.byId("lineItemsList").getItems()[iCurrentCell].getAggregation("cells")[14].setSelectedKey("");
			}
			// var sPlanDataSetPath = "/WorkpackageSet"
			this.getView().getModel().read("/" + sPlanDataSetPath + "/PlanDataSet", {
				success: function (oData2) {
					var oDataJsonModelComboBoxRoles = this.getView().getModel("PayloadComboBoxRoles");
					oDataJsonModelComboBoxRoles.setData({ mRolesEntity: oData2.results });
					var aItems = oDataJsonModelComboBoxRoles.getData().mRolesEntity;
					var results = [];
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
			if (oEvent.getParameter("listItem").isSelected() === false) {
				oEvent.getParameter("listItem").getCells()[12].setValue("");
				oEvent.getParameter("listItem").getCells()[11].setValue("");
				oEvent.getParameter("listItem").getCells()[12].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[11].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[8].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[9].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[10].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[13].setEnabled(false);
				oEvent.getParameter("listItem").getCells()[14].setEnabled(false);
			} else {
				oEvent.getParameter("listItem").getCells()[11].setEnabled(true);
				oEvent.getParameter("listItem").getCells()[8].setEnabled(true);
				oEvent.getParameter("listItem").getCells()[9].setEnabled(true);
				oEvent.getParameter("listItem").getCells()[10].setEnabled(true);
			}
			if (oEvent.getSource().getSelectedItems().length > 0) {
				this.getView().byId("saveButtonID").setEnabled(true);
			} else {
				this.getView().byId("saveButtonID").setEnabled(false);
			}
		},

		onSearch: function (oEvent) {
			var oFilterGroupItems = this.byId("FBid").getFilterGroupItems();
			if(oFilterGroupItems[0].getControl().getDateValue() == null || oFilterGroupItems[1].getControl().getDateValue() == null || oFilterGroupItems[2].getControl().getValue() == '') {
			MessageBox.confirm(this.getView().getModel("i18n").getResourceBundle().getText("MessageConfirmSearch"), {
				actions: ["Search Anyway", "Cancel"],
				emphasizedAction: "Search Anyway",
				onClose: function (sAction) {
					if (sAction === "Search Anyway") {
						this.searchFunctonality(oEvent)
					}
				}.bind(this)
			})
		} else {
			this.searchFunctonality(oEvent)
		}
		},

		searchFunctonality: function (oEvent) {
			var oTest = Object.assign({}, oEvent);
			this.getView().getModel("detailView").setProperty("/busyTable", true);
			var promise1 = this.prepeareFunctionForDetailViewTable(this.sObjectId);
			Promise.all([promise1]).then(function () {
				var promise2 = this.prepeareFunctionOfAdditionalPropertiesForModelWithSingleReadInModel(this.oJsonForDetailTable);
				var promise3 = this.prepeareFunctionOfAdditionalPropertiesForModelWithDoubleReadInModel(this.oJsonForDetailTable, this.sObjectId);
				// var promise3 = new Promise((resolve, reject) => {
				// 	resolve(this.prepeareModelForPurchaseOrder());
				// });
				Promise.all([promise2, promise3]).then(function () {
					this.oTemplateEqui = this.byId("lineItemsList").getBindingInfo("items").template
					this.byId("lineItemsList").unbindAggregation("items");
					this.byId("lineItemsList").bindItems({
						path: "Payload>/EntitySet",
						template: this.oTemplateEqui,
					});
					this.applyFilters(oTest);
				}.bind(this));
			}.bind(this));
		},

		applyFilters: function (oEvent) {
			this.enableComboBoxAfterFilteringFunction();
			this.byId("lineItemsList").removeSelections();
			var aFilters = [];
			if (this.byId("FBid").getFilterGroupItems()[3].getControl().getValue() !== "") {
				aFilters.push(new Filter("TimeSheetDataFields/BillingControlCategory", FilterOperator.EQ, this.byId("FBid").getFilterGroupItems()[3].getControl().getSelectedKey()));
			}
			if (this.byId("FBid").getFilterGroupItems()[4].getControl().getValue() !== "") {
				aFilters.push(new Filter("TimeSheetDataFields/ActivityType", FilterOperator.EQ, this.byId("FBid").getFilterGroupItems()[4].getControl().getSelectedKey()));
			}
			if (this.byId("FBid").getFilterGroupItems()[5].getControl().getValue() !== "") {
				aFilters.push(new Filter("TimeSheetStatus", FilterOperator.EQ, this.byId("FBid").getFilterGroupItems()[5].getControl().getSelectedKey()));
			}
			if (this.byId("FBid").getFilterGroupItems()[6].getControl().getValue() !== "") {
				aFilters.push(new Filter("TimeSheetDataFields/WBSElement", FilterOperator.EQ, this.byId("FBid").getFilterGroupItems()[6].getControl().getSelectedKey()));
			}

			aFilters.push(new Filter("TimeSheetStatus", FilterOperator.NE, '60'));
			aFilters.push(new Filter("TimeSheetStatus", FilterOperator.NE, '50'));
			aFilters.push(new Filter("TimeSheetRecord", FilterOperator.NE, ''));

			var oFilter = new Filter({
				filters: aFilters,
				and: true
			});

			this.byId("lineItemsList").getBinding("items").filter(oFilter, FilterType.Application);
			this.getView().getModel("detailView").setProperty("/busyTable", false);
		},

		enableComboBoxAfterFilteringFunction: function () {
			var aSelectedListItems = this.byId("lineItemsList").getSelectedItems();
			if (aSelectedListItems.length > 0) {
				for (var i = 0; i < aSelectedListItems.length; i++) {
					aSelectedListItems[i].getCells()[8].setEnabled(false);
					aSelectedListItems[i].getCells()[9].setEnabled(false);
					aSelectedListItems[i].getCells()[10].setEnabled(false);
					aSelectedListItems[i].getCells()[12].setSelectedKey("");
					aSelectedListItems[i].getCells()[12].setValue("");
					aSelectedListItems[i].getCells()[12].setEnabled(false);
					aSelectedListItems[i].getCells()[13].setEnabled(false);
					aSelectedListItems[i].getCells()[11].setEnabled(false);
					aSelectedListItems[i].getCells()[11].setSelectedKey("");
					aSelectedListItems[i].getCells()[11].setValue("");
				}
			}
		},

		datesFilterFunction: function (aFilters, oEvent) {
			var sFirstDayInPreviousMonth = this.firstDayInPreviousMonth(new Date());
			var sFifthDateOfCorrentMonth = this.fifthDayOfCurrentMonth(new Date());
			var fromDateValue = this.byId("FBid").getFilterGroupItems()[0].getControl().getDateValue();
			var toDateValue = this.byId("FBid").getFilterGroupItems()[1].getControl().getDateValue();
			var sFiltredDateToValue = new Date(toDateValue)
			sFiltredDateToValue.setDate(sFiltredDateToValue.getDate() + 1)
			if (fromDateValue !== null && toDateValue !== null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, fromDateValue, sFiltredDateToValue));
			}
			if (fromDateValue !== null && toDateValue === null) {
				var oNextDate = fromDateValue;
				oNextDate = new Date(oNextDate);
				oNextDate = oNextDate.setDate(oNextDate.getDate() + 1);
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, fromDateValue, oNextDate));
			}
			if (fromDateValue === null && toDateValue !== null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, sFirstDayInPreviousMonth, sFiltredDateToValue));
			}
			if (fromDateValue === null && toDateValue === null) {
				aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, sFirstDayInPreviousMonth,sFifthDateOfCorrentMonth));
			}
		}

	});

});