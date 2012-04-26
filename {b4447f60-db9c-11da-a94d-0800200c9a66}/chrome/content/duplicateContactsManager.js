var DuplicateContactsManager = {
	
	manageDuplicatesIsRunning: false,
	
	menuButtonAction: function() {
		this.manageDuplicates();
	},
	
	manageDuplicates: function() {
		this.manageDuplicatesIsRunning = true;
		var dupwindow = window.open('chrome://duplicatecontactsmanager/content/duplicateEntriesWindow.xul', "dupwindow", "chrome,centerscreen");
		dupwindow.focus();
	}
	
}
