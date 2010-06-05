var DuplicateContactsManager = {
	
	manageDuplicatesIsRunning: false,
	
	menuButtonAction: function() {
		//var str = duplicateContactsManagerWindowsRegistry.read(4, "Software\\U.S. Robotics\\Pilot Desktop\\Preferences", "DesktopUser");
		//alert(str);
		this.manageDuplicates();
	},
	
	manageDuplicates: function() {
		this.manageDuplicatesIsRunning = true;
		//document.getElementById('cmd_handle_duplicates').setAttribute('disabled', true);
		var dupwindow = window.open('chrome://duplicatecontactsmanager/content/duplicateEntriesWindow.xul', "dupwindow", "chrome,centerscreen");
		dupwindow.focus();
	}
	
}
