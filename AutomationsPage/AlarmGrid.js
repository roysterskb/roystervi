// File location: src/AutomationsPage/AlarmGrid.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const AlarmGrid = ({ alarms }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {alarms.map((alarm, index) => (
        <Card key={index} className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{alarm.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{alarm.description}</p>
            <p className="text-sm mt-2">
              <strong>Status:</strong> {alarm.status}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AlarmGrid;
