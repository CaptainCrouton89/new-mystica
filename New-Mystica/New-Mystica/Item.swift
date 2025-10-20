//
//  Item.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
