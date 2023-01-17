sap.ui.define([
	'sap/ui/core/format/DateFormat'
], function (DateFormat) {
	"use strict";

	return {
		/**
		 * Rounds the currency value to 2 digits
		 *
		 * @public
		 * @param {string} sValue value to be formatted
		 * @returns {string} formatted currency value with 2 digits
		 */
		currencyValue : function (sValue) {
			if (!sValue) {
				return "";
			}

			return parseFloat(sValue).toFixed(2);
		},
		projectVisibility:function(aRoles) {
			var bIsListItemVisible = true;
			if (aRoles) {
				bIsListItemVisible = !!aRoles.find(sTestt => sTestt.BusinessPartnerID === "00000010");
			}
			return bIsListItemVisible;
		},
		getEmployeeName:function(sValue) {
			var a = 1;
		},
		dateFormatter:function(sValue) {
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "dd.MM.yyyy" });   
			return  dateFormat.format(sValue);
		},
		billingTypeFormatter:function(sValue) {
			if (sValue === "") {
				return sValue = this.getView().getModel("i18n").getResourceBundle().getText("StatusFromaterBillable");
			} else {
				return sValue = this.getView().getModel("i18n").getResourceBundle().getText("StatusFromaterNonBillable");
			}
		},
		enableSaveButton:function(sValue) {
			var a = 1;
		},
		workItemFormatter:function(sValue) {
			if(sValue === "P002") {
				return sValue = "Remote"
			}
			if(sValue === "P001") {
				return sValue = "Onsite"
			}
		},

		activityTypeFormatter:function(sValue) {
			if(sValue === "T001") {
				return sValue = "Consulting Services"
			}
			if(sValue === "T002") {
				return sValue = "Client Support"
			}
			if(sValue === "T003") {
				return sValue = "Appl. Mgmt. Services"
			}
			if(sValue === "T004") {
				return sValue = "Managment cons."
			}
			if(sValue === "T005") {
				return sValue = "Jun. Cons. Services"
			}
			if(sValue === "T006") {
				return sValue = "Sen. Cons. Services"
			}
			if(sValue === "T007") {
				return sValue = "Solution Architect"
			}
			if(sValue === "T008") {
				return sValue = "Proj. /Progr. Mgmt."
			}
			if(sValue === "T009") {
				return sValue = "Partner"
			}
			if(sValue === "T010") {
				return sValue = "Techniker"
			}
			if(sValue === "T011") {
				return sValue = "Trainee"
			}
			if(sValue === "T012") {
				return sValue = "Development"
			}
			if(sValue === "T013") {
				return sValue = "Infastr. Services"
			}
			if(sValue === "T014") {
				return sValue = "Travel Cons. Serv."
			}
			if(sValue === "T015") {
				return sValue = "Travel Client Supp."
			}
			if(sValue === "T016") {
				return sValue = "Tra. Appl. Mgmt. Serv"
			}
			if(sValue === "T017") {
				return sValue = "Travel Mgmt. Cons."
			}
			if(sValue === "T018") {
				return sValue = "Travel Jun. Cons. Serv."
			}
			if(sValue === "T019") {
				return sValue = "Travel Sen. Cons. Serv."
			}
			if(sValue === "T020") {
				return sValue = "Travel Sol. Architect"
			}
			if(sValue === "T021") {
				return sValue = "Tra. Proj/Prog Mgmt."
			}
			if(sValue === "T022") {
				return sValue = "Travel Partner"
			}
			if(sValue === "T023") {
				return sValue = "Travel Techniker"
			}
			if(sValue === "T024") {
				return sValue = "Travel Trainee"
			}
			if(sValue === "T025") {
				return sValue = "Travel Development"
			}
			if(sValue === "T026") {
				return sValue = "Travel Infastr. Serv."
			}
			if(sValue === "T027") {
				return sValue = "Training"
			}
			if(sValue === "T028") {
				return sValue = "Travel Training"
			}
			if(sValue === "T029") {
				return sValue = "Materialerstellung"
			}
			if(sValue === "T030") {
				return sValue = "Travel Materialst."
			}
			if(sValue === "T031") {
				return sValue = "Trainingskonzeption"
			}
			if(sValue === "T032") {
				return sValue = "Travel Trainingskonz"
			}
			if(sValue === "T033") {
				return sValue = "Train the Trainer"
			}
			if(sValue === "T034") {
				return sValue = "Travel Train Trainer"
			}
			if(sValue === "T035") {
				return sValue = "Travel"
			}

		},
		StatusFormatter: function(sValue) {
			if(sValue === "10"){
				return sValue = this.getView().getModel("i18n").getResourceBundle().getText("StatusFromaterInProcess")
			}
			if(sValue === "20"){
				return sValue = this.getView().getModel("i18n").getResourceBundle().getText("StatusFromaterReleasedForApproval")
			}
			if(sValue === "30") {
				return sValue = this.getView().getModel("i18n").getResourceBundle().getText("StatusFromaterApproved")
			}
			if(sValue === "40") {
				return sValue = this.getView().getModel("i18n").getResourceBundle().getText("StatusFormatterApprovalRejected")
			}

		},

		billingTypeIconFormatter : function(sValue) {
			if (sValue == ""){
				return "sap-icon://paid-leave"
			} else {
				return "sap-icon://unpaid-leave"
			}
				
		},
		StatusIconFormatter: function(sValue) {
			if(sValue === "10"){
				return "sap-icon://request"
			}
			if(sValue === "20"){
				return sValue = "sap-icon://paper-plane"
			}
			if(sValue === "30") {
				return sValue = "sap-icon://employee-approvals"
			}
			if(sValue === "40") {
				return sValue = "sap-icon://employee-rejections"
			}
		},
		StatusStateFormatter : function(sValue) {
			if(sValue === "30") {
				return sValue = "Success"
			}
			if(sValue === "40") {
				return sValue = "Error"
			}
		},

		addCommaFirst: function(sValue) {
			if (sValue !== "") {
				return ", " + sValue
			}
		},
		addCommaSecond: function(sValue) {
			if (sValue !== "") {
				return ", " + sValue
			}
		}
	};
});